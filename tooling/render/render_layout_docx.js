#!/usr/bin/env node
// Process 4 (Assemble for Layout) -- render-layout-docx.sh's Node backend.
//
// Assembles one asset/locale into a PLAIN, unstyled .docx "manuscript" for a
// human layout designer to place into the real template by hand. Unlike the
// publish process (Process 2, render.js) and Process 3 (render_docx.js),
// this does NOT attempt the graphical layout at all:
//
//   - No translations-templates input: no cover art, brand fonts, sponsors
//     grid, page decorations or render_config.json. That's deliberate -- it
//     means this output never embeds the private brand assets (so, unlike
//     Process 3's DOCX, it's safe to hand to someone outside the admin group),
//     and it runs without the TEMPLATES_DEPLOY_KEY secret.
//   - Structure only, using Word's BUILT-IN styles (Title, Heading 1-6,
//     Normal, List Paragraph, Table Grid) so a designer's import mapping
//     (InDesign / Affinity / Word template) picks every element up by style
//     name instead of by guessing from fonts and sizes.
//   - Every page carries a real Word watermark (a diagonal VML text shape in
//     the header -- injected into the packed XML below, since docx-js has no
//     API for it) plus a running header (title / locale / version) and a
//     footer with the watermark text, page numbers and the content sha256.
//   - Reviewed content only: every section in status.json must be
//     "reviewed". There is deliberately no override flag.
//
// Section order and skip rules come from render_docx.js's gatherSections
// (itself kept in sync with render.js), so this assembles exactly the same
// sections, in the same order, as the published PDF. Two additions:
//   - A "<Base>_Figure[_N]" page scan dropped because its translated text
//     sibling exists (see render.js's hasTextSibling comment) is NOT
//     silently lost here: a visible placeholder marks where it sat, and the
//     localized SVG goes into figures/ next to the .docx as layout
//     reference. Sponsor/supporter figures get a "supplied with the
//     template" placeholder instead, and are not exported.
//   - Standalone figures that the PDF does render are embedded as PNG AND
//     exported to figures/ as self-contained SVG (vector source for layout).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const MarkdownIt = require("markdown-it");
const puppeteer = require("puppeteer");
const JSZip = require("jszip");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, ExternalHyperlink,
  Header, Footer, PageNumber, AlignmentType, LevelFormat, TableOfContents,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = require("docx");

const {
  PROJECT_URL, DEFAULT_CONFIG, loadRegistry, loadStatus, loadManifestOrder,
} = require("./render.js");
const { gatherSections, rasterizeSvg, fitWidth, MAX_IMAGE_WIDTH } = require("./render_docx.js");

const WATERMARK_TEXT = "DRAFT – NOT FOR DISTRIBUTION";
const WATERMARK_COLOR = "#C0392B";
// Locales whose primary script runs right-to-left. Paragraphs get Word's
// bidi property so the designer receives correctly ordered text.
const RTL_LANGS = new Set(["ar", "fa", "he", "ur", "ps", "yi", "dv", "ckb"]);

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--asset") args.asset = argv[++i];
    else if (a === "--locale") args.locale = argv[++i];
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--out-dir") args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  for (const req of ["asset", "locale", "root"]) {
    if (!args[req]) throw new Error(`--${req} is required`);
  }
  args.outDir = args.outDir || path.join(args.root, args.asset, args.locale, "release", "layout-handoff");
  return args;
}

// ---------------------------------------------------------------------------
// Readiness gate: reviewed-only, no override.
// ---------------------------------------------------------------------------
function assertAllReviewed(status, gatheredNames) {
  const sections = status.sections || {};
  const problems = [];
  for (const [name, s] of Object.entries(sections)) {
    if (s.status !== "reviewed") problems.push(`${name} (${s.status})`);
  }
  for (const name of gatheredNames) {
    if (!sections[name]) problems.push(`${name} (no status.json entry)`);
  }
  if (problems.length) {
    throw new Error(
      `layout handoff requires every section reviewed; not ready: ${problems.join(", ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// Markdown -> plain docx blocks (built-in styles only).
// ---------------------------------------------------------------------------
const HEADING_MAP = {
  1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
};

function inlineRuns(children, ctx, extra = {}) {
  const runs = [];
  let bold = !!extra.bold;
  let italics = false;
  let link = null; // { href, runs: [] } while inside link_open..link_close
  const push = (run) => (link ? link.runs.push(run) : runs.push(run));
  const textRun = (text, more = {}) => new TextRun({ text, bold, italics, rightToLeft: ctx.rtl, ...more });
  for (const tok of children || []) {
    switch (tok.type) {
      case "text": if (tok.content) push(textRun(tok.content)); break;
      case "strong_open": bold = true; break;
      case "strong_close": bold = !!extra.bold; break;
      case "em_open": italics = true; break;
      case "em_close": italics = false; break;
      case "code_inline": push(textRun(tok.content, { font: "Consolas" })); break;
      case "softbreak": push(textRun(" ")); break;
      case "hardbreak": push(new TextRun({ break: 1 })); break;
      case "image": push(textRun(`[Image: ${tok.content || tok.attrGet("src")}]`, { italics: true })); break;
      case "link_open": link = { href: tok.attrGet("href"), runs: [] }; break;
      case "link_close":
        if (link) {
          runs.push(/^https?:|^mailto:/.test(link.href || "")
            ? new ExternalHyperlink({ link: link.href, children: link.runs.map((r) => r) })
            : link.runs);
          link = null;
        }
        break;
      default: break;
    }
  }
  return runs.flat();
}

function para(ctx, opts) {
  return new Paragraph({ bidirectional: ctx.rtl, ...opts });
}

// Converts one section's markdown into an array of docx block elements
// (Paragraph | Table). Handles everything this project's content uses
// (headings, paragraphs, nested bullet/ordered lists, GFM tables,
// blockquotes, code blocks, rules) -- unlike Process 3's converter, tables
// are kept, since a layout designer needs them verbatim.
function markdownToBlocks(raw, ctx) {
  const tokens = md.parse(raw, {});
  const blocks = [];
  const listStack = []; // { ordered, instance }
  let quoteDepth = 0;
  let i = 0;

  const indent = () => (quoteDepth ? { left: 720 * quoteDepth } : undefined);

  while (i < tokens.length) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const level = Number(t.tag.slice(1));
        blocks.push(para(ctx, {
          heading: HEADING_MAP[level] || HeadingLevel.HEADING_6,
          keepNext: true,
          children: inlineRuns(tokens[i + 1].children, ctx),
        }));
        i += 3;
        continue;
      }
      case "paragraph_open": {
        const runs = inlineRuns(tokens[i + 1].children, ctx);
        if (listStack.length) {
          const top = listStack[listStack.length - 1];
          // Only the first paragraph of a list item carries the bullet/number.
          const numbered = !top.itemStarted;
          top.itemStarted = true;
          blocks.push(para(ctx, {
            children: runs,
            ...(numbered
              ? { numbering: { reference: top.ordered ? "layout-ordered" : "layout-bullet", level: Math.min(listStack.length - 1, 8), instance: top.instance } }
              : { indent: { left: 720 * listStack.length } }),
          }));
        } else {
          blocks.push(para(ctx, {
            children: runs,
            indent: indent(),
            style: quoteDepth ? "Quote" : undefined,
            spacing: { after: 120 },
          }));
        }
        i += 3;
        continue;
      }
      case "bullet_list_open":
      case "ordered_list_open":
        ctx.listInstance += 1;
        listStack.push({ ordered: t.type === "ordered_list_open", instance: ctx.listInstance });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        listStack.pop();
        break;
      case "list_item_open":
        if (listStack.length) listStack[listStack.length - 1].itemStarted = false;
        break;
      case "blockquote_open": quoteDepth++; break;
      case "blockquote_close": quoteDepth--; break;
      case "fence":
      case "code_block":
        for (const line of t.content.replace(/\n$/, "").split("\n")) {
          blocks.push(para(ctx, { children: [new TextRun({ text: line || " ", font: "Consolas" })], indent: indent() }));
        }
        break;
      case "hr":
        blocks.push(para(ctx, { children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } }));
        break;
      case "table_open": {
        const { table, next } = buildTable(tokens, i, ctx);
        blocks.push(table);
        // Word needs a paragraph between two adjacent tables, and it keeps
        // the following heading from butting up against the grid.
        blocks.push(para(ctx, { children: [] }));
        i = next;
        continue;
      }
      default: break;
    }
    i++;
  }
  return blocks;
}

function buildTable(tokens, start, ctx) {
  const rows = [];
  let cells = null;
  let inHead = false;
  let i = start + 1;
  for (; i < tokens.length && tokens[i].type !== "table_close"; i++) {
    const t = tokens[i];
    if (t.type === "thead_open") inHead = true;
    else if (t.type === "thead_close") inHead = false;
    else if (t.type === "tr_open") cells = [];
    else if (t.type === "tr_close") {
      rows.push(new TableRow({ tableHeader: inHead, cantSplit: true, children: cells }));
      cells = null;
    } else if (t.type === "th_open" || t.type === "td_open") {
      const isHead = t.type === "th_open";
      const inline = tokens[i + 1];
      cells.push(new TableCell({
        children: [para(ctx, { children: inlineRuns(inline.children, ctx, { bold: isHead }) })],
        shading: isHead ? { type: ShadingType.CLEAR, fill: "E7E6E6", color: "auto" } : undefined,
      }));
      i += 2; // inline + th_close/td_close
    }
  }
  const table = new Table({
    style: "TableGrid",
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: ctx.rtl,
    rows,
  });
  return { table, next: i + 1 };
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

// Inlines every relative href (the shared _source/images/ base raster) as a
// data: URI so the exported SVG opens standalone in Illustrator/InDesign.
function selfContainedSvg(svgText, localeDir) {
  return svgText.replace(/((?:xlink:)?href)="([^"]+)"/g, (match, attr, value) => {
    if (/^(https?:|data:)/.test(value)) return match;
    const abs = path.resolve(localeDir, value.replace(/^file:\/\//, ""));
    if (!fs.existsSync(abs)) return match;
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `${attr}="data:${mime};base64,${fs.readFileSync(abs).toString("base64")}"`;
  });
}

function placeholder(ctx, text) {
  return para(ctx, {
    keepLines: true,
    border: {
      top: { style: BorderStyle.DASHED, size: 6, color: "7F7F7F", space: 4 },
      bottom: { style: BorderStyle.DASHED, size: 6, color: "7F7F7F", space: 4 },
      left: { style: BorderStyle.DASHED, size: 6, color: "7F7F7F", space: 4 },
      right: { style: BorderStyle.DASHED, size: 6, color: "7F7F7F", space: 4 },
    },
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text, italics: true, color: "595959" })],
  });
}

function isSponsorsName(name) {
  return DEFAULT_CONFIG.sponsors.match_keywords.some((kw) => name.toLowerCase().includes(kw.toLowerCase()));
}

// Page scans render.js drops because a translated text sibling carries the
// same copy -- returned keyed by that sibling's name so the placeholder can
// be emitted right after it.
function droppedFigureScans(root, asset, locale) {
  const localeDir = path.join(root, asset, locale);
  const bySibling = new Map();
  for (const name of loadManifestOrder(root, asset)) {
    const m = name.match(/^(.*)_Figure(?:_\d+)?$/i);
    if (!m) continue;
    if (!fs.existsSync(path.join(localeDir, `${name}.svg`))) continue;
    if (!fs.existsSync(path.join(localeDir, `${m[1]}.md`))) continue;
    if (!bySibling.has(m[1])) bySibling.set(m[1], []);
    bySibling.get(m[1]).push(name);
  }
  return bySibling;
}

// ---------------------------------------------------------------------------
// Watermark + language injection (post-pack XML edits).
// ---------------------------------------------------------------------------
const VML_NS = {
  "xmlns:v": "urn:schemas-microsoft-com:vml",
  "xmlns:o": "urn:schemas-microsoft-com:office:office",
  "xmlns:w10": "urn:schemas-microsoft-com:office:word",
};

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Word's own watermark markup (what Design > Watermark > Custom writes),
// with the standard text-path shapetype definition.
function watermarkParagraphXml(text, idx) {
  return `<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict>`
    + `<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e">`
    + `<v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/>`
    + `<v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/>`
    + `<v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/>`
    + `<v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas>`
    + `<v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/>`
    + `<v:textpath on="t" fitshape="t"/><v:handles><v:h position="#0,bottomRight" xrange="6629,14971"/></v:handles>`
    + `<o:lock v:ext="edit" text="t" shapetype="t"/></v:shapetype>`
    + `<v:shape id="LayoutHandoffWatermark${idx}" o:spid="_x0000_s${2049 + idx}" type="#_x0000_t136" `
    + `style="position:absolute;margin-left:0;margin-top:0;width:480pt;height:80pt;rotation:315;z-index:-251654144;`
    + `mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" `
    + `o:allowincell="f" fillcolor="${WATERMARK_COLOR}" stroked="f">`
    + `<v:fill opacity=".3"/><v:textpath style="font-family:&quot;Arial&quot;;font-size:1pt" string="${xmlEscape(text)}"/>`
    + `<w10:wrap anchorx="margin" anchory="margin"/></v:shape></w:pict></w:r></w:p>`;
}

function ensureNamespaces(xml, rootTag) {
  return xml.replace(new RegExp(`<${rootTag}\\b([^>]*)>`), (m, attrs) => {
    let a = attrs;
    for (const [k, v] of Object.entries(VML_NS)) if (!a.includes(`${k}=`)) a += ` ${k}="${v}"`;
    return `<${rootTag}${a}>`;
  });
}

async function postProcess(buffer, { locale, rtl }) {
  const zip = await JSZip.loadAsync(buffer);
  const headerFiles = Object.keys(zip.files).filter((f) => /^word\/header\d+\.xml$/.test(f));
  if (!headerFiles.length) throw new Error("internal: packed docx has no header part to carry the watermark");
  let idx = 0;
  for (const f of headerFiles) {
    let xml = await zip.file(f).async("string");
    xml = ensureNamespaces(xml, "w:hdr");
    xml = xml.replace("</w:hdr>", `${watermarkParagraphXml(WATERMARK_TEXT, idx++)}</w:hdr>`);
    zip.file(f, xml);
  }
  // Document-wide proofing language, so spell-check/hyphenation in the
  // designer's tools runs in the target language instead of en-US.
  const stylesPath = "word/styles.xml";
  let styles = await zip.file(stylesPath).async("string");
  const lang = `<w:lang w:val="${locale}"${rtl ? ` w:bidi="${locale}"` : ""}/>`;
  if (/<w:rPrDefault>\s*<w:rPr>/.test(styles)) {
    styles = styles.replace(/<w:rPrDefault>\s*<w:rPr>/, (m) => `${m}${lang}`);
  } else if (styles.includes("<w:docDefaults>")) {
    styles = styles.replace("<w:docDefaults>", `<w:docDefaults><w:rPrDefault><w:rPr>${lang}</w:rPr></w:rPrDefault>`);
  }
  zip.file(stylesPath, styles);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry(args.root);
  const assetEntry = registry.assets && registry.assets[args.asset];
  if (!assetEntry) throw new Error(`Asset "${args.asset}" not found in registry.yaml`);
  if (!(assetEntry.locales || []).includes(args.locale)) {
    throw new Error(`Locale "${args.locale}" is not registered for asset "${args.asset}"`);
  }

  // No templates: sponsors image_path stays null, so gatherSections treats
  // a sponsors figure like any other figure (handled below).
  const cfg = { sponsors: { ...DEFAULT_CONFIG.sponsors, image_path: null } };
  const { sections, rawContentParts } = gatherSections({
    root: args.root, asset: args.asset, locale: args.locale, cfg, templatesRoot: null,
  });
  const status = loadStatus(args.root, args.asset, args.locale);
  assertAllReviewed(status, sections.map((s) => s.name));

  const lang = args.locale.split("-")[0].toLowerCase();
  const ctx = { rtl: RTL_LANGS.has(lang), listInstance: 0 };
  const localeDir = path.join(args.root, args.asset, args.locale);
  const dropped = droppedFigureScans(args.root, args.asset, args.locale);

  // Same content checksum as render.js / render_docx.js (computed over the
  // same raw section text), so the handoff can be matched to the PDF.
  const rawContent = rawContentParts.join("\n");
  const contentChecksum = crypto.createHash("sha256").update(rawContent, "utf-8").digest("hex");
  const today = new Date().toISOString().slice(0, 10);

  const figuresDir = path.join(args.outDir, "figures");
  fs.rmSync(args.outDir, { recursive: true, force: true });
  fs.mkdirSync(figuresDir, { recursive: true });
  const exported = []; // { file, kind, after }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-layout-docx-"));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  let title = null;
  const body = [];
  try {
    let figureIndex = 0;
    for (const section of sections) {
      if (section.type === "md") {
        if (!title) {
          const m = section.raw.match(/^#\s+(.+)$/m);
          if (m) title = m[1].trim();
        }
        body.push(...markdownToBlocks(section.raw, ctx));
        for (const figName of dropped.get(section.name) || []) {
          if (isSponsorsName(figName)) {
            body.push(placeholder(ctx, `[Sponsor / supporter logos for "${section.name}" are supplied with the layout template — not included in this file.]`));
            continue;
          }
          const file = `${figName}.svg`;
          fs.writeFileSync(path.join(figuresDir, file),
            selfContainedSvg(fs.readFileSync(path.join(localeDir, file), "utf-8"), localeDir));
          exported.push({ file, kind: "reference scan (translated text overlay)", after: section.name });
          body.push(placeholder(ctx, `[Figure — ${figName}: the original page layout for this section is in figures/${file} with translated labels. Its text is already included above; use the file as a visual reference only.]`));
        }
      } else if (section.type === "svg") {
        const pngPath = path.join(tmpDir, `figure-${figureIndex++}.png`);
        const { width, height } = await rasterizeSvg(browser, section.svgPath, section.localeDir, pngPath);
        body.push(para(ctx, {
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: fs.readFileSync(pngPath), type: "png", transformation: fitWidth(width, height, MAX_IMAGE_WIDTH) })],
        }));
        body.push(para(ctx, { style: "Caption", alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Figure: ${section.name} (vector source: figures/${section.name}.svg)` })] }));
        const file = `${section.name}.svg`;
        fs.writeFileSync(path.join(figuresDir, file),
          selfContainedSvg(fs.readFileSync(section.svgPath, "utf-8"), section.localeDir));
        fs.copyFileSync(pngPath, path.join(figuresDir, `${section.name}.png`));
        exported.push({ file, kind: "figure (also embedded as PNG)", after: section.name });
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  title = title || args.asset;
  const generatedBy = process.env.GITHUB_ACTOR ? `@${process.env.GITHUB_ACTOR} via GitHub Actions` : os.userInfo().username;

  // -- Front matter: handoff sheet for the layout designer --
  const kv = (k, v) => new TableRow({ children: [
    new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: "E7E6E6", color: "auto" }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true })] })] }),
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v) })] })] }),
  ] });
  const front = [
    new Paragraph({ style: "Title", bidirectional: ctx.rtl, children: [new TextRun({ text: title, rightToLeft: ctx.rtl })] }),
    new Paragraph({ style: "Subtitle", children: [new TextRun({ text: `Layout handoff — ${args.locale} — ${WATERMARK_TEXT}` })] }),
    new Table({ style: "TableGrid", width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      kv("Asset", args.asset),
      kv("Version", assetEntry.version),
      kv("Locale", `${args.locale}${ctx.rtl ? " (right-to-left)" : ""}`),
      kv("Template to lay out in", assetEntry.template || "(see registry.yaml)"),
      kv("Generated", `${today} by ${generatedBy}`),
      kv("Content sha256", contentChecksum),
    ] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Notes for layout")] }),
    ...[
      "Everything after the table of contents is the reviewed translation, in final reading order. Do not edit the wording; send corrections back to the locale reviewers.",
      "Structure is carried by Word's built-in styles (Heading 1–6, Normal, List, Quote, Table Grid, Caption). Map those styles to the template's styles on import.",
      "Cover, legal notice, sponsor logos, fonts and page decoration come from the template, not from this file.",
      "Dashed grey boxes mark where a figure or template-supplied element belongs. Figure source files are in the figures/ folder delivered with this file.",
      `The "${WATERMARK_TEXT}" watermark, header and footer are for this handoff only and must not appear in the laid-out document.`,
    ].map((text) => new Paragraph({ numbering: { reference: "layout-bullet", level: 0, instance: 0 }, children: [new TextRun(text)] })),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Review record")] }),
    new Table({ style: "TableGrid", width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ tableHeader: true, children: ["Section", "Reviewer", "Reviewed", "PR"].map((h) => new TableCell({ shading: { type: ShadingType.CLEAR, fill: "E7E6E6", color: "auto" }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) }),
      ...sections.map((s) => {
        const st = (status.sections || {})[s.name] || {};
        return new TableRow({ cantSplit: true, children: [s.name, st.reviewer || "", st.reviewed_at || "", st.pr ? `#${st.pr}` : ""].map((v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18 })] })] })) });
      }),
    ] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Contents")] }),
    new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({ pageBreakBefore: true, children: [] }),
  ];

  const levels = (format, text) => Array.from({ length: 9 }, (_, lvl) => ({
    level: lvl, format, text: text(lvl), alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 * (lvl + 1), hanging: 360 } } },
  }));
  const bullets = ["•", "◦", "▪"];

  const header = new Header({ children: [new Paragraph({
    style: "Header", bidirectional: ctx.rtl,
    children: [new TextRun({ text: `${title} — ${args.locale} — v${assetEntry.version}`, size: 16, color: "595959", rightToLeft: ctx.rtl })],
  })] });
  const footer = new Footer({ children: [
    new Paragraph({ style: "Footer", tabStops: [{ type: "right", position: 9000 }], children: [
      new TextRun({ text: WATERMARK_TEXT, bold: true, color: WATERMARK_COLOR.slice(1), size: 16 }),
      new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16 }),
    ] }),
    new Paragraph({ style: "Footer", children: [new TextRun({ text: `${PROJECT_URL} — sha256:${contentChecksum}`, size: 12, color: "999999" })] }),
  ] });

  const doc = new Document({
    creator: PROJECT_URL,
    title: `${title} — ${args.locale} — layout handoff`,
    subject: "OWASP GenAI Security Project translations: layout handoff manuscript",
    description: `${WATERMARK_TEXT}. sha256:${contentChecksum}`,
    features: { updateFields: true },
    numbering: { config: [
      { reference: "layout-bullet", levels: levels(LevelFormat.BULLET, (l) => bullets[l % 3]) },
      { reference: "layout-ordered", levels: levels(LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
    ] },
    sections: [{
      properties: { titlePage: false },
      headers: { default: header },
      footers: { default: footer },
      children: [...front, ...body],
    }],
  });

  const packed = await Packer.toBuffer(doc);
  const finalBuf = await postProcess(packed, { locale: args.locale, rtl: ctx.rtl });
  const docxName = `${args.asset}_${args.locale}_${assetEntry.version}_LAYOUT.docx`;
  const docxPath = path.join(args.outDir, docxName);
  fs.writeFileSync(docxPath, finalBuf);

  const notes = [
    `# Layout handoff — ${title} (${args.locale})`,
    "",
    `**${WATERMARK_TEXT}.** Reviewed translation for layout into \`${assetEntry.template}\`.`,
    "",
    `- Asset: \`${args.asset}\` v${assetEntry.version}`,
    `- Generated: ${today} by ${generatedBy}`,
    `- Content sha256: \`${contentChecksum}\` (matches the published PDF's footer checksum)`,
    "",
    "## Files",
    "",
    `- \`${docxName}\` — the manuscript (see its first page for layout notes)`,
    ...exported.map((e) => `- \`figures/${e.file}\` — ${e.kind}, belongs after section \`${e.after}\``),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(args.outDir, "HANDOFF.md"), notes);
  if (!exported.length) fs.rmSync(figuresDir, { recursive: true, force: true });

  console.log(`out=${docxPath}`);
  console.log(`out_dir=${args.outDir}`);
  console.log(`sha256=${contentChecksum}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`render_layout_docx.js failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { markdownToBlocks, assertAllReviewed, watermarkParagraphXml };
