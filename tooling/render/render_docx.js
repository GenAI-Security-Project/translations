#!/usr/bin/env node
// Process 3 (Assemble & Publish, DOCX variant), component 5b --
// render-docx.sh's Node backend. Assembles the same locale/asset/template
// combination as render.js (Process 2) -- same registry.yaml, same
// _manifest.json section order, same status.json readiness gate, same
// translations-templates render_config.json -- into a .docx instead of a
// .pdf. Shares render.js's registry/config loaders (see the exports at the
// bottom of that file) rather than a second, drifting copy of them; only
// the section-gathering skip rules below (table_of_contents, sponsors-figure
// swap, dead-TOC-scan detection) are duplicated from render.js's main()
// loop, because they're entangled there with HTML string-building -- keep
// these in sync with render.js by hand if that logic ever changes, the same
// way render_config_schema.py and render.js's own DEFAULT_CONFIG are kept
// in sync by hand today.
//
// Known simplifications vs. the PDF (documented, not oversights):
//   - Cover background image IS cropped to just the navy band now (see
//     cropImageTopBand), matching render.js's CSS object-fit:cover result --
//     via an offscreen canvas in the same headless Chrome instance already
//     used for SVG rasterization, not a new dependency.
//   - Real font FILES (Poppins/Barlow/the Cyrillic fallback) ARE embedded now
//     (see loadEmbeddedFonts) -- docx-js v9's Document({fonts}) option
//     supports this; an earlier version of this comment, written against an
//     older assumption, said it didn't. Only one weight per family is
//     embedded (Regular/SemiBold/Medium, whichever each role uses) -- Word
//     synthesizes bold/italic from that single weight rather than switching
//     to a different weight file.
//   - Poppins and Barlow have zero Cyrillic glyphs (same gap render.js's
//     CYRILLIC_FALLBACK_FONT comment documents) -- every TextRun built from
//     translated content goes through makeTextRuns, which splits on script
//     boundaries and swaps in the embedded Cyrillic fallback font per
//     segment, since Word's rFonts has no unicode-range equivalent to do
//     this automatically the way CSS @font-face does for the PDF.
//   - Heading 1's underline rule is a full-width paragraph border, not the
//     real template's short, fixed-width (193.5pt) drawn line -- docx-js has
//     no simple "draw a line shape" component, and a paragraph border always
//     spans the paragraph's own full width. Same color/thickness, wider
//     extent.
//   - No diagonal semi-transparent watermark -- Word's real watermark is a
//     VML/shape header docx-js doesn't expose a high-level API for. A
//     preview (non --final) docx instead gets a bold banner line at the top
//     of the body and in the footer of every page.
//   - The Table of Contents is a real, native Word TOC field
//     (docx.TableOfContents) that Word populates/updates itself -- this is
//     *better* than the PDF's two-pass manual page-number computation, not
//     a compromise, but it means a viewer must "update fields" (Word does
//     this on open by default; LibreOffice resolves it when converting/
//     rendering) to see page numbers rather than reading them pre-baked.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const MarkdownIt = require("markdown-it");
const puppeteer = require("puppeteer");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
  Header, Footer, PageNumber, AlignmentType, LevelFormat, TableOfContents,
  BorderStyle, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  VerticalPositionAlign, VerticalPositionRelativeFrom,
} = require("docx");

const {
  PROJECT_URL, loadRenderConfig, loadRegistry, loadManifestOrder, loadStatus,
  resolveSvgImagePaths, normalizeForMatch,
} = require("./render.js");

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function parseArgs(argv) {
  const args = { final: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--asset") args.asset = argv[++i];
    else if (a === "--locale") args.locale = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--templates-root") args.templatesRoot = argv[++i];
    else if (a === "--final") args.final = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  for (const req of ["asset", "locale", "root", "templatesRoot"]) {
    if (!args[req]) throw new Error(`--${req.replace(/([A-Z])/g, "-$1").toLowerCase()} is required`);
  }
  args.out = args.out || null;
  return args;
}

// Mirrors render.js's main()'s section-gathering loop (skip rules and all),
// but yields structured data instead of HTML strings -- see the file-level
// comment above about keeping this in sync with render.js by hand.
function gatherSections({ root, asset, locale, cfg, templatesRoot }) {
  const order = loadManifestOrder(root, asset);
  const localeDir = path.join(root, asset, locale);
  const sponsorsImageAbsPath = cfg.sponsors.image_path
    // See render.js's identical comment -- kept in sync by hand.
    ? path.join(templatesRoot, "sponsorlogo", cfg.sponsors.image_path)
    : null;

  const tocMdPath = path.join(localeDir, "Table_of_Content.md");
  let tocHeadingText = null;
  if (fs.existsSync(tocMdPath)) {
    const m = fs.readFileSync(tocMdPath, "utf-8").match(/^#\s+(.+)$/m);
    if (m) tocHeadingText = normalizeForMatch(m[1]);
  }

  const sections = [];
  const rawContentParts = [];

  for (const name of order) {
    if (/^table_of_contents?$/i.test(name)) continue;
    // See render.js's identical check for why -- kept in sync by hand.
    if (/^preface_figure$/i.test(name)) continue;

    const mdPath = path.join(localeDir, `${name}.md`);
    const svgPath = path.join(localeDir, `${name}.svg`);

    const isSponsorsFigure = sponsorsImageAbsPath && fs.existsSync(svgPath)
      && cfg.sponsors.match_keywords.some((kw) => name.toLowerCase().includes(kw.toLowerCase()));
    if (isSponsorsFigure) {
      sections.push({ name, type: "sponsors-image", imagePath: sponsorsImageAbsPath });
      continue;
    }

    if (fs.existsSync(mdPath)) {
      const raw = fs.readFileSync(mdPath, "utf-8").replace(/^<!--\s*status:.*?-->\n?/, "");
      rawContentParts.push(raw);
      sections.push({ name, type: "md", raw });
    } else if (fs.existsSync(svgPath)) {
      const svg = fs.readFileSync(svgPath, "utf-8");
      const firstOcrText = svg.match(/<text[^>]*>([^<]*)<\/text>/);
      const isDuplicateTocScan = tocHeadingText && firstOcrText && normalizeForMatch(firstOcrText[1]) === tocHeadingText;
      // See render.js's identical check for why -- kept in sync by hand.
      const figureSuffixMatch = name.match(/^(.*)_Figure(?:_\d+)?$/i);
      const hasTextSibling = figureSuffixMatch && fs.existsSync(path.join(localeDir, `${figureSuffixMatch[1]}.md`));
      if (isDuplicateTocScan || hasTextSibling) continue;
      rawContentParts.push(svg);
      sections.push({ name, type: "svg", svgPath, localeDir });
    }
  }

  return { order, sections, rawContentParts, localeDir, tocHeadingText };
}

// Walks markdown-it's flat token stream into docx Paragraph objects.
// Handles what this project's actual translated content uses: h1-h3
// headings, paragraphs, ordered/bullet lists (one level), and inline
// bold/italic/code -- not a general-purpose markdown-to-docx converter.
// runDefaults ({font, size, color}, all optional) applies to every run this
// produces -- the brand font/size/color for whichever context called this
// (body text vs. a specific heading level), same values render.js's CSS
// pulls from cfg.fonts/cfg.headings for the PDF.
function inlineChildrenToRuns(children, runDefaults) {
  const runs = [];
  let bold = false;
  let italics = false;
  for (const tok of children || []) {
    if (tok.type === "text") {
      if (tok.content) runs.push(...makeTextRuns(tok.content, { bold, italics, ...runDefaults }));
    } else if (tok.type === "strong_open") bold = true;
    else if (tok.type === "strong_close") bold = false;
    else if (tok.type === "em_open") italics = true;
    else if (tok.type === "em_close") italics = false;
    else if (tok.type === "code_inline") runs.push(new TextRun({ text: tok.content, bold, italics, font: "Consolas" }));
    else if (tok.type === "softbreak" || tok.type === "hardbreak") runs.push(new TextRun({ text: " ", ...runDefaults }));
    // link_open/link_close: no-op -- the wrapped text token still prints the
    // link's visible text (including bare autolinked URLs, since linkify is
    // on); true ExternalHyperlink runs aren't built for v1, see file header.
  }
  return runs;
}

// docx-js wants a bare family name ("Barlow"), not render.js's fontFamilyFor
// (a CSS value, quoted, with a "sans-serif"/"monospace" fallback that isn't
// a real installable font name Word could ever match). Returns undefined
// when unconfigured, so callers can spread it into TextRun options and let
// docx-js fall back to its own default rather than passing a bogus family.
function docxFontFamily(key, fonts) {
  const spec = fonts && fonts[key];
  return spec ? spec.family : undefined;
}

// See render.js's identical CYRILLIC_UNICODE_RANGE/CYRILLIC_FALLBACK_FONT
// comment -- Poppins and Barlow (every bundled brand font) have zero
// Cyrillic glyphs, confirmed against Google Fonts' own served CSS, not a
// bundling oversight. render.js solves this with a CSS unicode-range
// @font-face scoped to just the Cyrillic block, so Chrome silently falls
// through per-character. Word's rFonts has no per-character/per-script
// override that maps onto an arbitrary Unicode range the way CSS does
// (eastAsia/cs cover different script categories, not this one) -- the
// only way to reproduce the same visual result is to pre-split each run's
// text into Latin/Cyrillic segments ourselves and emit one TextRun per
// segment with the right font, which is what CYRILLIC_RANGE_RE and
// splitByScript below do. Without this, every Cyrillic character in a run
// whose font is Poppins/Barlow renders in whatever generic serif Word
// substitutes -- verified directly: this was the actual cause of ru-RU's
// DOCX output rendering in a visibly different (serif) font from its PDF.
const CYRILLIC_RANGE_RE = /[́Ѐ-џҐ-ґҰ-ұ№]/;
const CYRILLIC_FALLBACK_FONT_FILE = "NotoSans-Variable.ttf";
const CYRILLIC_FALLBACK_FAMILY = "Noto Sans";

function splitByScript(text) {
  const segments = [];
  let current = "";
  let currentIsCyrillic = null;
  for (const ch of text) {
    const isCyr = CYRILLIC_RANGE_RE.test(ch);
    if (currentIsCyrillic === null) currentIsCyrillic = isCyr;
    if (isCyr !== currentIsCyrillic) {
      segments.push({ text: current, cyrillic: currentIsCyrillic });
      current = "";
      currentIsCyrillic = isCyr;
    }
    current += ch;
  }
  if (current) segments.push({ text: current, cyrillic: currentIsCyrillic });
  return segments;
}

// Builds one or more TextRun objects for a single logical piece of text,
// splitting on script boundaries and swapping in CYRILLIC_FALLBACK_FAMILY
// for the Cyrillic segments -- see splitByScript's comment. Every TextRun
// construction site in this file that carries translated content (not
// literal ASCII like locale codes or URLs) should go through this instead
// of calling `new TextRun(...)` directly, so Cyrillic locales don't
// silently fall back to Word's generic serif.
function makeTextRuns(text, opts) {
  if (!text) return [];
  if (!opts.font) return [new TextRun({ text, ...opts })];
  return splitByScript(text).map((seg) => new TextRun({
    ...opts,
    text: seg.text,
    font: seg.cyrillic ? CYRILLIC_FALLBACK_FAMILY : opts.font,
  }));
}

// Loads the real font files (same ones render.js embeds via @font-face) so
// Word renders the actual brand typefaces regardless of what's installed on
// the machine opening the file, instead of silently substituting its own
// default the way any .docx referencing an unavailable font does. docx-js
// v9's Document({fonts}) option supports this (FontOptions: {name, data});
// only one weight per family is embedded (Regular for body, SemiBold for
// heading, Medium for subhead) -- Word synthesizes bold/italic from that
// single weight algorithmically rather than switching to a different weight
// file, a smaller and more acceptable gap than not embedding fonts at all.
function loadEmbeddedFonts(templatesRoot, fonts) {
  const embedded = [];
  const seen = new Set();
  for (const spec of Object.values(fonts || {})) {
    if (!spec || spec.source === "google" || !spec.family || seen.has(spec.family)) continue;
    const file = (spec.files || [])[0];
    if (!file) continue;
    seen.add(spec.family);
    embedded.push({
      name: spec.family,
      data: fs.readFileSync(path.join(templatesRoot, "assets", "fonts", file.path)),
    });
  }
  embedded.push({
    name: CYRILLIC_FALLBACK_FAMILY,
    data: fs.readFileSync(path.join(templatesRoot, "assets", "fonts", CYRILLIC_FALLBACK_FONT_FILE)),
  });
  return embedded;
}

// cfg.headings[h1/h2/...] -> {font, size (half-points), color} ready to
// spread into a TextRun/run-defaults object. Only sets the keys that are
// actually configured, same as render.js's buildHeadingCss.
function headingRunDefaults(levelKey, cfg) {
  const spec = cfg.headings && cfg.headings[levelKey];
  if (!spec) return {};
  const opts = {};
  if (spec.font) opts.font = docxFontFamily(spec.font, cfg.fonts);
  if (spec.size_pt) opts.size = spec.size_pt * 2; // docx sizes are half-points
  if (spec.color) opts.color = spec.color;
  return opts;
}

// The real template's heading rule is a short, fixed-width (193.5pt) drawn
// line, not a border -- docx-js has no simple "draw a line shape" component,
// and a Paragraph's own border always spans that paragraph's full width.
// Approximated here as a full-width bottom border rather than attempting
// the exact short-line shape via raw XML injection; same color/thickness,
// different (wider) extent. Known, documented simplification -- see the
// file header.
function headingBorder(levelKey, cfg) {
  const u = cfg.headings && cfg.headings[levelKey] && cfg.headings[levelKey].underline;
  if (!u) return undefined;
  return { bottom: { style: BorderStyle.SINGLE, size: Math.round(u.thickness_pt * 8), color: u.color, space: 4 } };
}

const HEADING_MAP = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

function markdownToDocxParagraphs(raw, cfg) {
  const tokens = md.parse(raw, {});
  const paragraphs = [];
  const bodyRunDefaults = { font: docxFontFamily("body", cfg.fonts) };
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "heading_open") {
      const level = Number(t.tag.slice(1));
      const runs = inlineChildrenToRuns(tokens[i + 1].children, headingRunDefaults(`h${level}`, cfg));
      // Word's native "keep with next" paragraph property -- the DOCX
      // equivalent of render.js's CSS page-break-after: avoid on headings.
      // Word's own pagination then never leaves this heading as the last
      // thing on a page; it pushes it (and the paragraph after it) onto the
      // next page as a unit instead.
      paragraphs.push(new Paragraph({
        heading: HEADING_MAP[level] || HeadingLevel.HEADING_3,
        keepNext: true,
        children: runs,
        spacing: { before: 240, after: 120 },
        border: headingBorder(`h${level}`, cfg),
      }));
      i += 3;
      continue;
    }
    if (t.type === "paragraph_open") {
      const runs = inlineChildrenToRuns(tokens[i + 1].children, bodyRunDefaults);
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 160 } }));
      i += 3;
      continue;
    }
    if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
      const ordered = t.type === "ordered_list_open";
      i++;
      while (tokens[i] && tokens[i].type !== "bullet_list_close" && tokens[i].type !== "ordered_list_close") {
        if (tokens[i].type === "list_item_open") {
          i++;
          if (tokens[i].type === "paragraph_open") i++;
          const runs = inlineChildrenToRuns(tokens[i].children, bodyRunDefaults);
          i++;
          if (tokens[i] && tokens[i].type === "paragraph_close") i++;
          paragraphs.push(new Paragraph({
            children: runs,
            numbering: { reference: ordered ? "docx-ordered" : "docx-bullet", level: 0 },
            spacing: { after: 100 },
          }));
          if (tokens[i] && tokens[i].type === "list_item_close") i++;
        } else {
          i++;
        }
      }
      i++;
      continue;
    }
    i++;
  }
  return paragraphs;
}

// Renders an SVG figure to PNG via a headless page (docx-js's ImageRun needs
// a raster format) -- reuses render.js's own href-rewriting so the figure's
// underlying (shared, per-locale-OCR'd) image resolves the same way it does
// in the PDF path.
async function rasterizeSvg(browser, svgPath, localeDir, outPngPath) {
  const svg = fs.readFileSync(svgPath, "utf-8");
  const resolved = resolveSvgImagePaths(svg, localeDir);
  const widthMatch = svg.match(/width="(\d+)"/);
  const heightMatch = svg.match(/height="(\d+)"/);
  const width = widthMatch ? Number(widthMatch[1]) : 1000;
  const height = heightMatch ? Number(heightMatch[1]) : 1000;
  const htmlPath = outPngPath + ".html";
  fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><head><style>body{margin:0;}</style></head><body>${resolved}</body></html>`);
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height });
    await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
    await page.screenshot({ path: outPngPath, clip: { x: 0, y: 0, width, height } });
  } finally {
    await page.close();
    fs.rmSync(htmlPath, { force: true });
  }
  return { width, height };
}

// Scales a natural image size down to a page-friendly display width,
// preserving aspect ratio -- docx-js's ImageRun transformation is a hard
// pixel width/height with no CSS-style max-width/auto-height behavior.
function fitWidth(naturalWidth, naturalHeight, maxWidth) {
  if (naturalWidth <= maxWidth) return { width: naturalWidth, height: naturalHeight };
  const scale = maxWidth / naturalWidth;
  return { width: maxWidth, height: Math.round(naturalHeight * scale) };
}

const MAX_IMAGE_WIDTH = 600; // px, comfortable inside a US Letter/A4 content area at default margins
// Same COVER_TOP_BAND_RATIO render.js's cover uses for background_image_position:
// "top" (see that file's own comment for how this figure was measured against
// the real cover-band.png asset).
const COVER_TOP_BAND_RATIO = 0.205;

// Same PAGE_WIDTH_MM/PAGE_HEIGHT_MM render.js feeds to Puppeteer's page.pdf()
// `format` -- kept in sync by hand. render_docx.js previously never read
// cfg.page.size/margins at all, so Word/LibreOffice fell back to whatever
// page size ships in docx-js's own built-in default (observed to come out
// close to A4) regardless of the template's configured "Letter" -- wrong
// page dimensions, which is also why nothing could be sized to genuinely
// span the full page: there was no reliable "full page" to span.
const PAGE_HEIGHT_MM = { A4: 297, Letter: 279.4 };
const PAGE_WIDTH_MM = { A4: 210, Letter: 215.9 };
const MM_TO_TWIPS = 1440 / 25.4;
const MM_TO_PX = 96 / 25.4;
function mmToTwips(mm) { return Math.round(mm * MM_TO_TWIPS); }
function mmToPx(mm) { return Math.round(mm * MM_TO_PX); }

function docxPageProperties(cfg) {
  const widthMm = PAGE_WIDTH_MM[cfg.page.size] || PAGE_WIDTH_MM.A4;
  const heightMm = PAGE_HEIGHT_MM[cfg.page.size] || PAGE_HEIGHT_MM.A4;
  return {
    page: {
      size: { width: mmToTwips(widthMm), height: mmToTwips(heightMm) },
      margin: {
        top: mmToTwips(cfg.page.margins.top_mm),
        bottom: mmToTwips(cfg.page.margins.bottom_mm),
        left: mmToTwips(cfg.page.margins.left_mm),
        right: mmToTwips(cfg.page.margins.right_mm),
      },
    },
  };
}

// data: URLs, not file://, for loading image bytes into a headless page --
// confirmed by direct testing that this Chrome build's Image.decode() throws
// "EncodingError: The source image cannot be decoded" for every file:// src
// regardless of format, even though the same bytes decode fine as a data:
// URL. (This previously made probeImageDims silently fall back to its
// hardcoded placeholder dims every time, since it swallows decode errors --
// real dimensions are needed to scale images without distorting them, since
// docx-js has no CSS-style object-fit.)
function extToMime(ext) {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "svg") return "image/svg+xml";
  return "image/png";
}

function toDataUrl(buf, ext) {
  return `data:${extToMime(ext)};base64,${buf.toString("base64")}`;
}

// Probes a raster image's real pixel dimensions via a throwaway headless
// page rather than adding an image-metadata parsing dependency this project
// doesn't otherwise need -- ImageRun needs real dimensions to scale sensibly
// without distorting the image (docx-js has no CSS-style object-fit).
async function probeImageDims(browser, tmpDir, buf, ext, fallback) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return { width: img.naturalWidth, height: img.naturalHeight };
    }, toDataUrl(buf, ext));
  } catch {
    return fallback;
  } finally {
    await page.close();
  }
}

// Same measured fraction as render.js's COVER_FULL_BG_BAND_FRACTION for
// green-cover-background.jpg -- see that constant's comment for how it was
// derived. Crops the source image down to just the navy band (object-fit:
// cover's effective result) via an offscreen canvas, instead of inserting
// the whole tall image (mostly plain white below the band) at full width,
// which left a large dead-space gap before the cover text -- the PDF never
// has this gap because CSS crops the image itself rather than showing it in
// full.
const COVER_FULL_BG_BAND_FRACTION = 0.4704;

async function cropImageTopBand(browser, tmpDir, buf, ext, bandFraction) {
  const page = await browser.newPage();
  try {
    const result = await page.evaluate(async (src, frac) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const cropHeight = Math.round(img.naturalHeight * frac);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, img.naturalWidth, cropHeight, 0, 0, img.naturalWidth, cropHeight);
      return { dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: cropHeight };
    }, toDataUrl(buf, ext), bandFraction);
    return {
      buffer: Buffer.from(result.dataUrl.split(",")[1], "base64"),
      width: result.width,
      height: result.height,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry(args.root);
  const assetEntry = registry.assets && registry.assets[args.asset];
  if (!assetEntry) throw new Error(`Asset "${args.asset}" not found in registry.yaml`);

  const status = loadStatus(args.root, args.asset, args.locale);
  if (args.final) {
    const notReviewed = Object.entries(status.sections).filter(([, s]) => s.status !== "reviewed");
    if (notReviewed.length > 0) {
      const names = notReviewed.map(([n, s]) => `${n} (${s.status})`).join(", ");
      throw new Error(`--final requires every section reviewed; not yet reviewed: ${names}`);
    }
  }

  const cfg = loadRenderConfig(args.templatesRoot, assetEntry.template, args.locale);
  const { sections, rawContentParts, tocHeadingText } = gatherSections({
    root: args.root, asset: args.asset, locale: args.locale, cfg, templatesRoot: args.templatesRoot,
  });

  // Same authenticity checksum as render.js, over the same raw section
  // content -- a given locale/version should produce the identical sha256
  // regardless of output format, since it's computed over content, not
  // rendered bytes. Useful as a cross-check between the PDF and DOCX outputs.
  const rawContent = rawContentParts.join("\n");
  const contentChecksum = crypto.createHash("sha256").update(rawContent, "utf-8").digest("hex");
  const contentLength = Buffer.byteLength(rawContent, "utf-8");
  const publicationDate = new Date().toISOString().slice(0, 10);
  const trackingText = `${PROJECT_URL} — published ${publicationDate} — sha256:${contentChecksum} (${contentLength} bytes)`;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-docx-"));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  let firstH1Text = null;
  const bodyChildren = [];

  try {
    let figureIndex = 0;
    for (const section of sections) {
      if (section.type === "md") {
        if (!firstH1Text) {
          const m = section.raw.match(/^#\s+(.+)$/m);
          if (m) firstH1Text = m[1].trim();
        }
        bodyChildren.push(...markdownToDocxParagraphs(section.raw, cfg));
      } else if (section.type === "svg") {
        const pngPath = path.join(tmpDir, `figure-${figureIndex++}.png`);
        const { width, height } = await rasterizeSvg(browser, section.svgPath, section.localeDir, pngPath);
        const fitted = fitWidth(width, height, MAX_IMAGE_WIDTH);
        bodyChildren.push(new Paragraph({
          children: [new ImageRun({ data: fs.readFileSync(pngPath), type: "png", transformation: fitted })],
          spacing: { after: 200 },
        }));
      } else if (section.type === "sponsors-image") {
        const buf = fs.readFileSync(section.imagePath);
        const ext = path.extname(section.imagePath).slice(1).toLowerCase();
        const dims = await probeImageDims(browser, tmpDir, buf, ext, { width: MAX_IMAGE_WIDTH, height: MAX_IMAGE_WIDTH });
        const fitted = fitWidth(dims.width, dims.height, MAX_IMAGE_WIDTH);
        bodyChildren.push(new Paragraph({
          children: [new ImageRun({ data: buf, type: (ext === "jpg" ? "jpeg" : ext), transformation: fitted })],
          spacing: { after: 200 },
        }));
      }
    }

    const title = firstH1Text || assetEntry.title || args.asset;
    const today = new Date().toISOString().slice(0, 10);

    // -- Cover page --
    // Left-aligned text block below a full-width cropped band image, kicker
    // label, and a divider rule under the title -- matching render.js's
    // actual cover layout (see that file's renderCoverHtml) rather than the
    // earlier centered, kicker-less, divider-less, uncropped approximation.
    const coverChildren = [];
    const titleFont = docxFontFamily(cfg.cover.title_font, cfg.fonts);
    const subtitleFont = docxFontFamily(cfg.cover.subtitle_font, cfg.fonts);
    // See render.js's identical H1_MAX_SIZE_PT comment -- kept in sync by
    // hand. Without an explicit size here, Word's built-in Title style used
    // no cap at all (its own default, independent of cfg.headings.h1).
    const H1_MAX_SIZE_PT = 30;
    const coverTitleSize = Math.min((cfg.headings.h1 && cfg.headings.h1.size_pt) || H1_MAX_SIZE_PT, H1_MAX_SIZE_PT) * 2;
    if (cfg.cover.logo_path) {
      const logoBuf = fs.readFileSync(path.join(args.templatesRoot, "assets", "images", cfg.cover.logo_path));
      const dims = await probeImageDims(browser, tmpDir, logoBuf, "png", { width: 160, height: 160 });
      coverChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: logoBuf, type: "png", transformation: fitWidth(dims.width, dims.height, 160) })],
        spacing: { after: 300 },
      }));
    }
    // Cropped to just the navy band (object-fit:cover's effective result --
    // see cropImageTopBand's comment) instead of showing the whole tall
    // source image, most of which is plain white below the band -- that
    // white matches cfg.cover.background_color exactly, which is why
    // cropping it away is visually equivalent to render.js's full-image
    // object-fit:cover (same math: this source image's aspect ratio equals
    // the page's, so object-fit:cover never actually crops anything off
    // the image itself -- it only ever shows the band against a white page
    // underneath it, which is exactly what the crop reproduces directly).
    //
    // Floating and page-anchored (behindDocument, relative: PAGE, align
    // LEFT/TOP), not an inline centered image -- an inline image is always
    // constrained to the content column width and pushed down by the page's
    // top margin, so it can never reach the true page edge the way render.js's
    // zero-Puppeteer-margin cover pass does. Sized to the full page width
    // (not CONTENT_WIDTH_PX) for the same reason. See pageDecorationHeader
    // below for the same floating mechanism already used for page 2+.
    let coverBandBottomMm = 0;
    if (cfg.cover.background_image_path) {
      // Per-template directory, not the shared assets/images/ -- see
      // render.js's identical templateDir resolution. Kept in sync by hand.
      const bgBuf = fs.readFileSync(path.join(args.templatesRoot, assetEntry.template, cfg.cover.background_image_path));
      const pageWidthMm = PAGE_WIDTH_MM[cfg.page.size] || PAGE_WIDTH_MM.A4;
      const pageHeightMm = PAGE_HEIGHT_MM[cfg.page.size] || PAGE_HEIGHT_MM.A4;
      const isFull = cfg.cover.background_image_position === "full";
      const bandFraction = isFull ? COVER_FULL_BG_BAND_FRACTION : COVER_TOP_BAND_RATIO;
      // Same two formulas render.js's renderCoverHtml uses for bandBottomMm,
      // kept in sync by hand: "full" measures the fraction against the page
      // HEIGHT (the whole image is scaled to fill page height); "top"
      // measures it against the page WIDTH (the band is only ever as tall
      // as render.js's own CSS sizes it, independent of page height).
      coverBandBottomMm = isFull ? pageHeightMm * bandFraction : pageWidthMm * bandFraction;
      const bgExt = path.extname(cfg.cover.background_image_path).slice(1) || "png";
      const cropped = await cropImageTopBand(browser, tmpDir, bgBuf, bgExt, bandFraction);
      const fullPageWidthPx = mmToPx(pageWidthMm);
      const fitted = fitWidth(cropped.width, cropped.height, fullPageWidthPx);
      coverChildren.push(new Paragraph({
        children: [new ImageRun({
          data: cropped.buffer,
          type: "png",
          transformation: fitted,
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.LEFT },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.TOP },
            behindDocument: true,
            wrap: { type: "none" },
          },
        })],
      }));
    }
    // The floating band image no longer pushes the text column down the way
    // an inline image did, so that clearance has to be added back explicitly
    // -- same bandBottomMm + bandClearanceGapMm clearance render.js's
    // topClearanceMm (plus its own coverContentPaddingTopMm, folded in here
    // via the page's own top margin) positions the title block below, so
    // the text never sits on top of the band.
    const COVER_CONTENT_PADDING_MM = 20;
    const COVER_BAND_CLEARANCE_GAP_MM = 6;
    const marginTopMm = cfg.page.margins.top_mm;
    const coverContentTopMm = Math.max(
      COVER_CONTENT_PADDING_MM + marginTopMm,
      coverBandBottomMm + COVER_BAND_CLEARANCE_GAP_MM
    );
    const coverSpacingBeforeTwips = Math.max(0, mmToTwips(coverContentTopMm - marginTopMm));
    coverChildren.push(new Paragraph({ children: [], spacing: { after: coverSpacingBeforeTwips } }));
    if (!args.final) {
      coverChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cfg.watermark.text, bold: true, color: "C0392B", size: 32 })],
        spacing: { after: 400 },
      }));
    }
    // The real template's own cover text box: a small kicker label directly
    // above the title, left-aligned, not centered -- see render.js's
    // identical kickerHtml comment (not locale-specific, so not translated
    // per locale any more than the logo wordmark baked into the cover image
    // itself is).
    if (cfg.cover.kicker_text) {
      coverChildren.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: cfg.cover.kicker_text, font: titleFont, color: cfg.cover.text_color, size: 20 })],
        spacing: { after: 80 },
      }));
    }
    // h1Underline border on the title paragraph itself -- same full-width-
    // border-instead-of-short-rule simplification headingBorder() already
    // documents for body H1s, applied here for the same reason (docx-js has
    // no "draw a short line" primitive) rather than inventing a different
    // cover-only compromise.
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: makeTextRuns(title, { font: titleFont, color: cfg.cover.text_color, size: coverTitleSize }),
        spacing: { after: 160 },
        border: headingBorder("h1", cfg),
      }),
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: args.locale, font: subtitleFont, color: cfg.cover.text_color, size: 28 })], spacing: { after: 240 } }),
    );
    if (cfg.cover.show_version) coverChildren.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: assetEntry.version, font: subtitleFont, color: cfg.cover.text_color })] }));
    if (cfg.cover.show_date) coverChildren.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: today, font: subtitleFont, color: cfg.cover.text_color })] }));
    coverChildren.push(new Paragraph({ children: [], pageBreakBefore: false }));

    // -- Legal notice (its own page, right after the cover -- same
    // placement as render.js's renderLegalNoticeHtml) --
    const bodyFont = docxFontFamily("body", cfg.fonts);
    const legalChildren = [];
    if (cfg.legal_notice && cfg.legal_notice.text) {
      legalChildren.push(new Paragraph({
        pageBreakBefore: true,
        children: makeTextRuns(cfg.legal_notice.text, { font: bodyFont }),
      }));
    }

    // -- Table of contents (real, native Word field -- see file header) --
    const tocChildren = [];
    if (cfg.toc.include) {
      tocChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: makeTextRuns(tocHeadingText || cfg.toc.label, headingRunDefaults("h1", cfg)),
        border: headingBorder("h1", cfg),
      }));
      tocChildren.push(new TableOfContents("toc", { hyperlink: true, headingStyleRange: "1-2" }));
    }

    const numberingConfig = {
      config: [
        {
          reference: "docx-bullet",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        },
        {
          reference: "docx-ordered",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        },
      ],
    };

    // Every page except the cover gets this light corner decoration, the
    // same mechanism (and the exact same image) the real template uses:
    // a page-anchored, behind-document floating image in the section's
    // default header. See PageConfig.decoration_image_path's docstring for
    // how this was told apart from the cover's own, different band image.
    let pageDecorationHeader;
    if (cfg.page.decoration_image_path) {
      // Per-template directory, not the shared assets/images/ -- see
      // render.js's identical templateDir resolution. Kept in sync by hand.
      const decoBuf = fs.readFileSync(path.join(args.templatesRoot, assetEntry.template, cfg.page.decoration_image_path));
      const dims = await probeImageDims(browser, tmpDir, decoBuf, "png", { width: 440, height: 200 });
      pageDecorationHeader = new Header({
        children: [new Paragraph({
          children: [new ImageRun({
            data: decoBuf,
            type: "png",
            transformation: { width: dims.width, height: dims.height },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.RIGHT },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.TOP },
              behindDocument: true,
              wrap: { type: "none" },
            },
          })],
        })],
      });
    }

    const footerParagraphChildren = [];
    if (cfg.footer.show_url) footerParagraphChildren.push(new TextRun({ text: cfg.footer.url_text, size: 16 }));
    if (cfg.footer.show_url && cfg.footer.show_page_numbers) footerParagraphChildren.push(new TextRun({ text: "\t\t", size: 16 }));
    if (cfg.footer.show_page_numbers) {
      footerParagraphChildren.push(new TextRun({ children: ["Page ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16 }));
    }
    const footer = new Footer({
      children: [
        new Paragraph({ tabStops: [{ type: "right", position: 9000 }], children: footerParagraphChildren }),
        new Paragraph({ children: [new TextRun({ text: trackingText, size: 10, color: "999999" })] }),
        ...(!args.final ? [new Paragraph({ children: [new TextRun({ text: cfg.watermark.text, bold: true, color: "C0392B", size: 14 })] })] : []),
      ],
    });

    const doc = new Document({
      creator: PROJECT_URL,
      title: `${assetEntry.title || args.asset} -- ${args.locale}`,
      subject: "OWASP GenAI Security Project translations pipeline output",
      description: trackingText,
      numbering: numberingConfig,
      fonts: loadEmbeddedFonts(args.templatesRoot, cfg.fonts),
      sections: [
        {
          properties: docxPageProperties(cfg),
          children: coverChildren,
        },
        {
          properties: docxPageProperties(cfg),
          headers: pageDecorationHeader ? { default: pageDecorationHeader } : undefined,
          footers: { default: footer },
          children: [...legalChildren, ...tocChildren, ...bodyChildren],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const outPath = args.out || path.join(
      args.root, args.asset, args.locale, "release",
      `${args.asset}_${args.locale}_${assetEntry.version}${args.final ? "" : "_DRAFT"}.docx`
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
    console.log(`out=${outPath}`);
    console.log(`sha256=${contentChecksum}`);
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`render_docx.js failed: ${err.message}`);
  process.exit(1);
});
