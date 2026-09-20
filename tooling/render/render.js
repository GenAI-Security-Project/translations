#!/usr/bin/env node
// Process 2 (Assemble & Publish), component 5 -- render.sh's Node backend.
// Assembles a locale's reviewed sections into one PDF via markdown-it +
// Puppeteer. See tooling/render_config_schema.py for the config field
// reference this file's DEFAULT_CONFIG mirrors -- keep the two in sync by
// hand; the Python side is the authoring-time validator (admins/CI run it
// against translations-templates PRs), this side is the actual renderer.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");
const MarkdownIt = require("markdown-it");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

const PROJECT_URL = "https://www.genaisecurityproject.com";

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

// Mirrors render_config_schema.RenderConfig's defaults field-for-field.
const DEFAULT_CONFIG = {
  direction: "ltr",
  numerals: "western",
  page: { size: "A4", margins: { top_mm: 25, bottom_mm: 25, left_mm: 22, right_mm: 22 } },
  fonts: {},
  cover: {
    logo_path: null, background_image_path: null, background_image_position: "top",
    title_font: "heading", subtitle_font: "body",
    background_color: "#FFFFFF", text_color: "#000000", show_version: true, show_date: true,
  },
  toc: { include: true, label: "Table of Contents", max_depth: 2 },
  legal_notice: null,
  headings: {},
  line_breaking: { line_break: "auto", word_break: "normal", word_spacing: "normal", hyphens: "none", hyphens_lang: null },
  footer: {
    show_page_numbers: true, page_number_format: "{page}", show_url: true,
    url_text: "https://www.genaisecurityproject.com", url_href: "https://www.genaisecurityproject.com",
  },
  watermark: {
    text: "DRAFT — NOT FOR RELEASE", font_family: "heading", font_size_pt: 60,
    color: "#C0392B", opacity: 0.18, rotation_deg: -35, repeat: false,
  },
};

function deepMerge(base, override) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const key of Object.keys(override || {})) {
    const value = override[key];
    if (value && typeof value === "object" && !Array.isArray(value) && typeof out[key] === "object" && out[key] !== null) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function loadJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  delete raw._comment;
  return raw;
}

function loadRenderConfig(templatesRoot, template, locale) {
  const defaultPath = path.join(templatesRoot, template, "default", "render_config.json");
  let config = deepMerge(DEFAULT_CONFIG, loadJson(defaultPath));
  const overridePath = path.join(templatesRoot, template, locale, "render_config.json");
  if (fs.existsSync(overridePath)) {
    config = deepMerge(config, loadJson(overridePath));
  }
  return config;
}

function loadRegistry(root) {
  return yaml.load(fs.readFileSync(path.join(root, "registry.yaml"), "utf-8"));
}

function loadManifestOrder(root, asset) {
  const manifestPath = path.join(root, asset, "_source", "_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `${manifestPath} is missing -- this asset was split before source_manifest.py existed. ` +
      "Re-run the split (or write the manifest by hand) before rendering."
    );
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")).order;
}

function loadStatus(root, asset, locale) {
  const statusPath = path.join(root, asset, locale, "status.json");
  return JSON.parse(fs.readFileSync(statusPath, "utf-8"));
}

// @font-face blocks for every fonts{} entry. "bundled" fonts resolve to a
// file:// URL under translations-templates/assets/fonts/ -- Puppeteer needs
// an absolute path here, a relative url() won't resolve once the HTML is
// handed to page.setContent() with no base URL of its own.
function fontFaceCss(fonts, templatesRoot) {
  const blocks = [];
  const googleHrefs = [];
  for (const [key, spec] of Object.entries(fonts)) {
    if (spec.source === "google" && spec.google_href) {
      googleHrefs.push(spec.google_href);
      continue;
    }
    for (const file of spec.files || []) {
      const absPath = path.join(templatesRoot, "assets", "fonts", file.path);
      const url = "file://" + absPath;
      blocks.push(
        `@font-face { font-family: "${spec.family}"; src: url("${url}"); ` +
        `font-weight: ${file.weight || 400}; font-style: ${file.style || "normal"}; }`
      );
    }
  }
  return { faceCss: blocks.join("\n"), googleHrefs };
}

function fontFamilyFor(key, fonts) {
  const spec = fonts[key];
  return spec ? `"${spec.family}"` : (key === "monospace" ? "monospace" : "sans-serif");
}

function buildWatermarkCss(cfg, fonts) {
  const w = cfg.watermark;
  if (!w || w.enabled === false) return "";
  const family = fontFamilyFor(w.font_family, fonts);
  // Wraps to 2-3 lines within 70% of the page width rather than forcing one
  // long nowrap line -- at a large font size a single line's rotated
  // diagonal footprint is comfortably wider than the page itself and runs
  // off the edge regardless of exact wording (a translated watermark string
  // in another locale won't be this same length, so this needs to hold for
  // any reasonable text, not just the English default).
  return `
    .draft-watermark {
      position: fixed; left: 0; top: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none; z-index: 9999;
    }
    .draft-watermark span {
      display: inline-block; width: 70%; text-align: center;
      font-family: ${family}; font-size: ${w.font_size_pt}pt; font-weight: 700;
      line-height: 1.15;
      color: ${w.color}; opacity: ${w.opacity};
      transform: rotate(${w.rotation_deg}deg);
    }`;
}

function renderCoverHtml(cfg, meta) {
  const logoImg = cfg.cover.logo_path
    ? `<img src="file://${meta.logoAbsPath}" style="max-width: 220px; margin-bottom: 48px;" />`
    : "";
  const versionLine = cfg.cover.show_version ? `<p class="cover-meta">${meta.version}</p>` : "";
  const dateLine = cfg.cover.show_date ? `<p class="cover-meta">${meta.date}</p>` : "";

  // "top": a decorative band across roughly the top third, like the real
  // OWASP cover art (a gradient + circle/dragonfly motif graphic, not a
  // flat fill) -- content sits below it, not on top of it. "full": the
  // image covers the entire page behind the content.
  let bgLayer = "";
  let contentStyle = "justify-content: center;";
  if (cfg.cover.background_image_path && meta.coverBgAbsPath) {
    if (cfg.cover.background_image_position === "full") {
      bgLayer = `<img class="cover-bg cover-bg-full" src="file://${meta.coverBgAbsPath}" alt="">`;
    } else {
      bgLayer = `<img class="cover-bg cover-bg-top" src="file://${meta.coverBgAbsPath}" alt="">`;
      contentStyle = "justify-content: flex-end; padding-bottom: 15%;";
    }
  }

  return `
    <section class="page cover" style="background:${cfg.cover.background_color}; color:${cfg.cover.text_color}; position: relative; overflow: hidden;">
      ${bgLayer}
      <div class="cover-content" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; height: 100%; ${contentStyle}">
        ${logoImg}
        <h1 class="cover-title" style="font-family:${fontFamilyFor(cfg.cover.title_font, cfg.fonts)}">${meta.title}</h1>
        <p class="cover-subtitle" style="font-family:${fontFamilyFor(cfg.cover.subtitle_font, cfg.fonts)}">${meta.locale}</p>
        ${versionLine}
        ${dateLine}
      </div>
    </section>`;
}

function renderLegalNoticeHtml(cfg) {
  if (!cfg.legal_notice || !cfg.legal_notice.text) return "";
  return `<section class="page legal-notice"><p>${cfg.legal_notice.text}</p></section>`;
}

function renderTocHtml(cfg, headings) {
  if (!cfg.toc.include) return "";
  const items = headings
    .filter((h) => h.level <= cfg.toc.max_depth)
    .map((h) => `<li class="toc-level-${h.level}">${h.text}</li>`)
    .join("\n");
  // No leader-dot page numbers yet -- an accurate TOC needs a two-pass
  // render (measure page numbers, then re-render with them filled in).
  // Titles-only is the honest v1 rather than fabricated/misleading numbers.
  return `
    <section class="page toc">
      <h2>${cfg.toc.label}</h2>
      <ul>${items}</ul>
    </section>`;
}

function extractHeadings(sectionsHtml) {
  const headings = [];
  const re = /<h([12])[^>]*>(.*?)<\/h\1>/gi;
  for (const html of sectionsHtml) {
    let m;
    while ((m = re.exec(html))) headings.push({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "") });
  }
  return headings;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry(args.root);
  const assetEntry = registry.assets && registry.assets[args.asset];
  if (!assetEntry) throw new Error(`Asset "${args.asset}" not found in registry.yaml`);

  const status = loadStatus(args.root, args.asset, args.locale);
  const order = loadManifestOrder(args.root, args.asset);

  if (args.final) {
    const notReviewed = Object.entries(status.sections).filter(([, s]) => s.status !== "reviewed");
    if (notReviewed.length > 0) {
      const names = notReviewed.map(([n, s]) => `${n} (${s.status})`).join(", ");
      throw new Error(`--final requires every section reviewed; not yet reviewed: ${names}`);
    }
  }

  const cfg = loadRenderConfig(args.templatesRoot, assetEntry.template, args.locale);
  const localeDir = path.join(args.root, args.asset, args.locale);

  const sectionsHtml = [];
  const rawContentParts = []; // feeds the authenticity checksum below -- the
  // actual translated text/figures, not the generated HTML wrapper around them,
  // so the checksum reflects content changes, not renderer/styling changes.
  for (const name of order) {
    const mdPath = path.join(localeDir, `${name}.md`);
    const svgPath = path.join(localeDir, `${name}.svg`);
    if (fs.existsSync(mdPath)) {
      // Every section file leads with a <!-- status: draft|reviewed|... -->
      // banner for GitHub PR review -- pipeline metadata, not content; with
      // HTML parsing off, markdown-it would otherwise print it as literal text.
      const raw = fs.readFileSync(mdPath, "utf-8").replace(/^<!--\s*status:.*?-->\n?/, "");
      rawContentParts.push(raw);
      sectionsHtml.push(`<section class="content-section">${md.render(raw)}</section>`);
    } else if (fs.existsSync(svgPath)) {
      const svg = fs.readFileSync(svgPath, "utf-8");
      rawContentParts.push(svg);
      sectionsHtml.push(`<section class="content-section figure">${svg}</section>`);
    }
    // A section/figure not yet drafted (no file either way) is simply
    // skipped in a non-final preview; --final already refused above if
    // anything required is missing.
  }

  // Authenticity tracking, stamped faintly on every page (per request: URL +
  // publication date + a checksum over the document) -- covers the actual
  // assembled content, not the PDF bytes themselves (which would be
  // circular: the checksum can't depend on a PDF that doesn't exist until
  // after this render finishes). A reader can re-split the same locale's
  // files, recompute this same hash, and confirm the PDF wasn't altered
  // after publication.
  const rawContent = rawContentParts.join("\n");
  const contentChecksum = crypto.createHash("sha256").update(rawContent, "utf-8").digest("hex");
  const contentLength = Buffer.byteLength(rawContent, "utf-8");
  const publicationDate = new Date().toISOString().slice(0, 10);
  const trackingText = `${PROJECT_URL} — published ${publicationDate} — sha256:${contentChecksum} (${contentLength} bytes)`;

  const headings = extractHeadings(sectionsHtml);
  const { faceCss, googleHrefs } = fontFaceCss(cfg.fonts, args.templatesRoot);
  const watermarkCss = args.final ? "" : buildWatermarkCss(cfg, cfg.fonts);
  // watermark.repeat isn't implemented yet (v1 is a single centered stamp
  // regardless of that flag) -- see buildWatermarkCss's comment.
  const watermarkHtml = args.final ? "" : `<div class="draft-watermark"><span>${cfg.watermark.text}</span></div>`;

  const today = new Date().toISOString().slice(0, 10);
  // registry.yaml has no dedicated title field (see registry_schema.py) --
  // the asset's own first-level heading (its real document title) is a far
  // better cover title than the slug-like asset id; the id is only a
  // last-resort fallback for a section-set with no h1 at all.
  const firstH1 = headings.find((h) => h.level === 1);
  const coverHtml = renderCoverHtml(cfg, {
    title: (firstH1 && firstH1.text) || assetEntry.title || args.asset,
    version: assetEntry.version,
    date: today,
    locale: args.locale,
    logoAbsPath: cfg.cover.logo_path ? path.join(args.templatesRoot, "assets", "images", cfg.cover.logo_path) : null,
    coverBgAbsPath: cfg.cover.background_image_path
      ? path.join(args.templatesRoot, "assets", "images", cfg.cover.background_image_path)
      : null,
  });
  const legalHtml = renderLegalNoticeHtml(cfg);
  const tocHtml = renderTocHtml(cfg, headings);

  const googleLinkTags = googleHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");

  const sharedHead = `
<meta charset="utf-8">
<title>${assetEntry.title || args.asset} -- ${args.locale}</title>
${googleLinkTags}
<style>
${faceCss}
* { box-sizing: border-box; }
body {
  font-family: ${fontFamilyFor("body", cfg.fonts)};
  direction: ${cfg.direction};
  line-break: ${cfg.line_breaking.line_break};
  word-break: ${cfg.line_breaking.word_break};
  word-spacing: ${cfg.line_breaking.word_spacing === "none" ? "-0.05em" : "normal"};
  ${cfg.line_breaking.hyphens === "auto" ? `hyphens: auto; -webkit-hyphens: auto;` : "hyphens: none;"}
  ${cfg.line_breaking.hyphens_lang ? `` : ""}
}
.page { page-break-after: always; padding: 20mm; }
.cover { height: 100%; text-align: center; padding: 0; }
.cover-bg { position: absolute; left: 0; top: 0; z-index: 0; }
.cover-bg-top { width: 100%; height: auto; }
.cover-bg-full { width: 100%; height: 100%; object-fit: cover; }
.cover-title { font-size: 36pt; margin-bottom: 12pt; }
.cover-subtitle { font-size: 18pt; margin-bottom: 24pt; }
.cover-meta { font-size: 12pt; opacity: 0.8; }
.toc ul { list-style: none; padding: 0; }
.toc-level-1 { font-weight: 600; margin-top: 8pt; }
.toc-level-2 { margin-left: 16pt; }
.content-section { margin-bottom: 18pt; page-break-inside: avoid; }
.content-section.figure svg { max-width: 100%; height: auto; }
${watermarkCss}
.tracking-stamp {
  position: fixed; left: 0; bottom: 3mm; width: 100%; text-align: center;
  font-family: sans-serif; font-size: 5pt; letter-spacing: 0.2px;
  color: #000000; opacity: 0.12; pointer-events: none; z-index: 9998;
  white-space: nowrap;
}
</style>`;

  const bodyAttrs = cfg.line_breaking.hyphens_lang ? ` lang="${cfg.line_breaking.hyphens_lang}"` : "";

  // The page-number/URL footer excludes the cover (a common convention --
  // a cover isn't "page 1" the way a reader counts pages) -- Puppeteer's
  // footerTemplate has no per-page toggle, so the cover renders as its own
  // single-page PDF with no footer at all, and everything else renders
  // separately with the footer on; the two are merged below. The watermark
  // and tracking stamp are unaffected -- both still appear on the cover.
  const coverOnlyHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${coverHtml}
</body>
</html>`;

  const restHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${legalHtml}
${tocHtml}
${sectionsHtml.join("\n")}
</body>
</html>`;

  const footerUrlHtml = cfg.footer.show_url
    ? (cfg.footer.url_href
        ? `<a href="${cfg.footer.url_href}" style="color:inherit; text-decoration:none;">${cfg.footer.url_text}</a>`
        : cfg.footer.url_text)
    : "";
  const pageNumberFooter = cfg.footer.show_page_numbers
    ? `<div style="font-size:8pt; width:100%; display:flex; justify-content:space-between; padding:0 10mm;">
         <span>${footerUrlHtml}</span>
         <span>${cfg.footer.page_number_format.replace("{page}", '<span class="pageNumber"></span>').replace("{total}", '<span class="totalPages"></span>')}</span>
       </div>`
    : `<div></div>`;

  // page.setContent() gives the page no real origin, and Chrome refuses
  // file:// font/image loads from a page with no origin -- fonts silently
  // fall back to a generic serif/sans and <img src="file://..."> renders
  // blank, with no error surfaced anywhere. Writing each HTML doc to a real
  // file and page.goto()-ing it gives the page an actual file:// origin,
  // under which same-machine file:// resource loads work normally.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-"));
  const coverHtmlPath = path.join(tmpDir, "cover.html");
  const restHtmlPath = path.join(tmpDir, "rest.html");
  fs.writeFileSync(coverHtmlPath, coverOnlyHtml);
  fs.writeFileSync(restHtmlPath, restHtml);

  const pdfMargin = {
    top: `${cfg.page.margins.top_mm}mm`,
    bottom: `${cfg.page.margins.bottom_mm}mm`,
    left: `${cfg.page.margins.left_mm}mm`,
    right: `${cfg.page.margins.right_mm}mm`,
  };

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  try {
    const coverPage = await browser.newPage();
    await coverPage.goto("file://" + coverHtmlPath, { waitUntil: "networkidle0" });
    const coverPdfBuffer = await coverPage.pdf({
      format: cfg.page.size,
      margin: pdfMargin,
      displayHeaderFooter: false,
      printBackground: true,
    });

    const restPage = await browser.newPage();
    await restPage.goto("file://" + restHtmlPath, { waitUntil: "networkidle0" });
    const restPdfBuffer = await restPage.pdf({
      format: cfg.page.size,
      margin: pdfMargin,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: pageNumberFooter,
      printBackground: true,
    });

    // Merge: the cover's own single-page PDF (no footer) followed by every
    // page of the footer-enabled body PDF, whose own pageNumber counter
    // starts at 1 -- so "page 1" as shown to the reader is the first page
    // after the cover, matching "exclude the cover" as the reader sees it.
    const mergedDoc = await PDFDocument.create();
    const coverSrc = await PDFDocument.load(coverPdfBuffer);
    const restSrc = await PDFDocument.load(restPdfBuffer);
    for (const p of await mergedDoc.copyPages(coverSrc, coverSrc.getPageIndices())) mergedDoc.addPage(p);
    for (const p of await mergedDoc.copyPages(restSrc, restSrc.getPageIndices())) mergedDoc.addPage(p);

    // Same tracking info as the on-page stamp, but as real PDF metadata --
    // survives independently of the visual stamp (readable by any PDF tool,
    // e.g. `exiftool` or `pdfinfo`, without opening/rendering the file) and
    // gives a second, redundant channel: a page could be re-printed/scanned
    // and lose the metadata while keeping the on-page stamp, or vice versa.
    mergedDoc.setSubject("OWASP GenAI Security Project translations pipeline output");
    mergedDoc.setKeywords([PROJECT_URL, `published:${publicationDate}`, `sha256:${contentChecksum}`, `bytes:${contentLength}`]);
    mergedDoc.setProducer("OWASP GenAI Security Project translations pipeline");
    mergedDoc.setCreator(PROJECT_URL);
    const finalBuffer = Buffer.from(await mergedDoc.save());

    const outPath = args.out || path.join(
      args.root, args.asset, args.locale, "release",
      `${args.asset}_${args.locale}_${assetEntry.version}${args.final ? "" : "_DRAFT"}.pdf`
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, finalBuffer);
    console.log(`out=${outPath}`);
    console.log(`sha256=${contentChecksum}`);
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`render.js failed: ${err.message}`);
  process.exit(1);
});
