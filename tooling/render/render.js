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
  sponsors: { image_path: null, match_keywords: ["sponsor", "supporter", "acknowledgement"] },
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
// A figure's svg is written at <asset>/<locale>/<name>.svg and its <image>
// deliberately points at the shared base file with a relative href,
// "../_source/images/<name>.png" (see svg_localize.py) -- correct from
// that svg's own real location, but this svg gets inlined verbatim into a
// generated HTML document that lives somewhere else entirely (a temp
// directory), where the same relative path resolves to nothing. Chrome
// doesn't error on a broken image src -- it silently renders nothing for
// a normal <img>, but for an SVG <image> element it was observed to paint
// a corrupted/garbled placeholder over the whole figure instead. Rewriting
// every href/xlink:href to an absolute file:// URL, resolved from the
// svg's real directory, fixes it regardless of where the temp HTML lives.
function resolveSvgImagePaths(svgText, localeDir) {
  return svgText.replace(/((?:xlink:)?href)="([^"]+)"/g, (match, attr, value) => {
    if (/^(https?:|data:|file:)/.test(value)) return match;
    const absPath = path.resolve(localeDir, value);
    return `${attr}="file://${absPath}"`;
  });
}

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

const PAGE_HEIGHT_MM = { A4: 297, Letter: 279.4 };
const PAGE_WIDTH_MM = { A4: 210, Letter: 215.9 };

// The real OWASP cover-band.png (used as-is, unmodified) is a single tall
// asset: a navy gradient band with the OWASP dragonfly/circle motif across
// its top ~19%, then plain white for the rest (that white bulk is Word's
// own background for the page, since Word overlays this image behind body
// text and doesn't need it to be a self-contained banner). Measured on the
// real 2551x2771 asset: the navy-to-white transition sits at row 522
// (522/2771 = 0.1884 of the image's own height). Displayed at the page's
// full content width, that band renders at (0.1884 * naturalAspectRatio)
// of the content width; naturalAspectRatio (2771/2551 = 1.086) folds in to
// give ~0.205 of the content width. This crops (via CSS object-fit, not by
// touching the file) to just that band, leaving the dragonfly intact and
// the rest of the cover filled by cfg.cover.background_color instead of
// the image's own baked-in white.
const COVER_TOP_BAND_RATIO = 0.205;

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
  // .cover's own height:100% (in the stylesheet) resolves against body,
  // which has no defined height in this print-layout DOM (no single
  // fixed-height "page" element exists before Puppeteer paginates) -- so
  // it was actually shrinking to fit its short flowing text content, and
  // silently clipping anything taller (a full-bleed cover image) via its
  // own overflow:hidden. An explicit physical height sidesteps that.
  // Puppeteer's own margin option reserves this much space outside the
  // printable content area -- the HTML only ever needs to fill what's left.
  const pageHeightMm = (PAGE_HEIGHT_MM[cfg.page.size] || PAGE_HEIGHT_MM.A4)
    - cfg.page.margins.top_mm - cfg.page.margins.bottom_mm;

  // An explicit physical height on the cover section itself, applied
  // whenever there's a background image, regardless of "top" or "full" --
  // needed for "full" so the image isn't clipped to the section's own
  // shrink-to-fit height (see above); applied to "top" too so the section
  // (and its background_color fill) spans the whole page, leaving no bare
  // white gap below a short decorative band. This only works cleanly
  // alongside the .cover-title/subtitle/meta margin resets below --
  // without those, unaccounted default <p>/<h1> margins push the last
  // centered line past this fixed height and Chrome's print paginator
  // spills it onto the *next* page instead of containing it here
  // (overflow:hidden clips visually but doesn't prevent that).
  const sectionHeightStyle = (cfg.cover.background_image_path && meta.coverBgAbsPath)
    ? `height: ${pageHeightMm}mm;`
    : "";

  let bgLayer = "";
  if (cfg.cover.background_image_path && meta.coverBgAbsPath) {
    if (cfg.cover.background_image_position === "full") {
      const heightMm = pageHeightMm * 0.82;
      bgLayer = `<img class="cover-bg cover-bg-full" style="height: ${heightMm}mm;" src="file://${meta.coverBgAbsPath}" alt="">`;
    } else {
      const contentWidthMm = (PAGE_WIDTH_MM[cfg.page.size] || PAGE_WIDTH_MM.A4)
        - cfg.page.margins.left_mm - cfg.page.margins.right_mm;
      const bandHeightMm = contentWidthMm * COVER_TOP_BAND_RATIO;
      bgLayer = `<img class="cover-bg cover-bg-top" style="height: ${bandHeightMm}mm;" src="file://${meta.coverBgAbsPath}" alt="">`;
    }
  }
  const contentStyle = "justify-content: center;";

  return `
    <section class="page cover" style="background:${cfg.cover.background_color}; color:${cfg.cover.text_color}; position: relative; overflow: hidden; ${sectionHeightStyle}">
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

// tocHeadings: already filtered to cfg.toc.max_depth (see main()) and in
// document order. pageNumbers: a parallel array of page numbers, or null on
// the first measurement pass, when page numbers aren't known yet -- rendered
// as an empty leader with nothing after the dots. The markup is identical
// either way (same elements, same CSS) so filling in a short number on the
// second pass doesn't reflow the front matter and invalidate the page
// numbers just measured from the first pass.
function renderTocHtml(cfg, tocHeadings, pageNumbers) {
  if (!cfg.toc.include) return "";
  const items = tocHeadings
    .map((h, i) => {
      const num = pageNumbers ? pageNumbers[i] : null;
      return `<li class="toc-level-${h.level}"><span class="toc-title">${h.text}</span><span class="toc-dots"></span><span class="toc-page">${num || ""}</span></li>`;
    })
    .join("\n");
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
    while ((m = re.exec(html))) headings.push({ level: Number(m[1]), text: decodeHtmlEntities(m[2].replace(/<[^>]+>/g, "")) });
  }
  return headings;
}

const HTML_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};
// Heading text is pulled from markdown-it's rendered HTML (still
// entity-encoded, e.g. typographer output like &mdash; or &rsquo;), but the
// PDF text layer we search it against (see computeHeadingPageNumbers) holds
// the actual decoded characters a browser would display -- without this,
// a heading containing any of these would never match and silently lose its
// page number.
function decodeHtmlEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === "#") {
      const codePoint = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? whole : String.fromCodePoint(codePoint);
    }
    return HTML_ENTITIES[code.toLowerCase()] || whole;
  });
}

function normalizeForMatch(text) {
  return text.replace(/\s+/g, " ").trim();
}

// Loads a PDF buffer and returns its text content one string per page, in
// page order. pdfjs-dist ships ESM-only from v5 -- this file is CommonJS, so
// the import has to be dynamic (top-level `require` can't load an ESM
// package); dynamic import works fine from inside an async function.
async function extractPageTexts(pdfBuffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;
  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(normalizeForMatch(content.items.map((item) => item.str).join(" ")));
  }
  return pageTexts;
}

// Matches each heading, in document order, to the first page (a 1-indexed
// "rest" page number, exactly what the footer's own page-number counter
// prints) its title text appears on, starting the search only after
// frontMatterPageCount pages -- otherwise every heading would "match" on the
// TOC's own page, which lists every title verbatim with no page number yet.
// The pointer only ever moves forward, so a title that's also referenced
// elsewhere (e.g. an appendix cross-reference table) can't steal an earlier
// heading's slot, though it could in principle cause a later heading to
// match a passing mention rather than its own section if that mention
// contains the exact full title text -- not observed in practice, since
// cross-references in this project's documents use short IDs, not full
// titles, but noted here as this approach's one known limitation.
function computeHeadingPageNumbers(pageTexts, headings, frontMatterPageCount) {
  let pointer = frontMatterPageCount;
  return headings.map((h) => {
    const needle = normalizeForMatch(h.text);
    for (let i = pointer; i < pageTexts.length; i++) {
      if (pageTexts[i].includes(needle)) {
        pointer = i;
        return i + 1;
      }
    }
    return null;
  });
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
  const sponsorsImageAbsPath = cfg.sponsors.image_path
    ? path.join(args.templatesRoot, "assets", "images", cfg.sponsors.image_path)
    : null;

  // The source PDF's own printed table of contents sometimes got captured
  // *twice* at split time: once as running text (the "Table_of_Content"
  // section, always skipped above) and once as a whole separate scanned
  // figure with OCR text overlaid (name derived from its position, not its
  // content -- e.g. "..._Figure_3" -- so it can't be caught by name like the
  // text section can). Both are the source's own dead table of contents,
  // now superseded by the accurate one this renderer generates, and both
  // carry the source's own now-wrong page numbers baked into their text.
  // Detected here by comparing a figure's first OCR'd line against
  // Table_of_Content.md's own heading (in whatever language this locale
  // uses) rather than a hardcoded phrase list, so it holds for any locale.
  const tocMdPath = path.join(localeDir, "Table_of_Content.md");
  let tocHeadingText = null;
  if (fs.existsSync(tocMdPath)) {
    const m = fs.readFileSync(tocMdPath, "utf-8").match(/^#\s+(.+)$/m);
    if (m) tocHeadingText = normalizeForMatch(m[1]);
  }

  for (const name of order) {
    // The source PDF's own printed table of contents gets split out as an
    // ordinary content section like any other (its manifest name comes from
    // its English heading text at split time, before translation, so this
    // matches regardless of locale) -- but it's a dead duplicate now that
    // this renderer builds its own accurate one (see renderTocHtml): its
    // text is literally the *source* document's own heading list with the
    // *source* document's own page numbers baked in as plain text, both
    // meaningless once retranslated and repaginated. Observed in practice
    // producing exactly that: a garbled block of stale titles and wrong
    // page numbers sitting between the real intro and the real first
    // section. Always skipped, unconditionally -- there's no world where
    // shipping the source's own dead TOC as body content is correct.
    if (/^table_of_contents?$/i.test(name)) continue;

    const mdPath = path.join(localeDir, `${name}.md`);
    const svgPath = path.join(localeDir, `${name}.svg`);
    // A sponsors/supporters FIGURE changes on the org's own sponsor-roster
    // schedule, not this asset's translation cycle -- when the template
    // configures a shared image, a figure (never a text section -- matching
    // must not touch mdPath, or a same-named text section like a plain
    // "Acknowledgements" heading gets silently swallowed too) whose name
    // matches gets that one shared, swappable file instead of this asset's
    // own (per-locale, OCR'd) figure. See SponsorsConfig's docstring.
    const isSponsorsFigure = sponsorsImageAbsPath && fs.existsSync(svgPath)
      && cfg.sponsors.match_keywords.some((kw) => name.toLowerCase().includes(kw.toLowerCase()));
    if (isSponsorsFigure) {
      sectionsHtml.push(`<section class="content-section figure"><img src="file://${sponsorsImageAbsPath}" alt="Sponsors"></section>`);
      continue; // shared template asset, not this asset's own content -- excluded from the content checksum below
    }

    if (fs.existsSync(mdPath)) {
      // Every section file leads with a <!-- status: draft|reviewed|... -->
      // banner for GitHub PR review -- pipeline metadata, not content; with
      // HTML parsing off, markdown-it would otherwise print it as literal text.
      const raw = fs.readFileSync(mdPath, "utf-8").replace(/^<!--\s*status:.*?-->\n?/, "");
      rawContentParts.push(raw);
      sectionsHtml.push(`<section class="content-section">${md.render(raw)}</section>`);
    } else if (fs.existsSync(svgPath)) {
      const svg = fs.readFileSync(svgPath, "utf-8");
      const firstOcrText = svg.match(/<text[^>]*>([^<]*)<\/text>/);
      const isDuplicateTocScan = tocHeadingText && firstOcrText && normalizeForMatch(firstOcrText[1]) === tocHeadingText;
      if (isDuplicateTocScan) continue; // see the tocHeadingText comment above
      rawContentParts.push(svg);
      sectionsHtml.push(`<section class="content-section figure">${resolveSvgImagePaths(svg, localeDir)}</section>`);
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
  const tocHeadings = headings.filter((h) => h.level <= cfg.toc.max_depth);
  const tocHtmlPass1 = renderTocHtml(cfg, tocHeadings, null);

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
/* object-fit:cover + object-position:top crops the tall source image
   (used as-is, unmodified -- see COVER_TOP_BAND_RATIO above) down to just
   its top navy band, dragonfly included, instead of showing the plain
   white lower ~80% of the asset. */
.cover-bg-top { width: 100%; object-fit: cover; object-position: top; }
/* Matches the real OWASP template's own placement exactly: the source
   docx anchors this image at a fixed 8.486in x 9.222in box (a:stretch +
   fillRect = the whole image non-uniformly stretched to fill that exact
   box, not cropped) on a page whose height puts that at ~79-84% --
   object-fit:cover would crop this image's near-square aspect ratio down
   to an unrecognizable sliver on a portrait page; fill (stretch) is what
   Word itself actually does here. */
.cover-bg-full { width: 100%; object-fit: fill; }
/* Explicit margin resets throughout -- default browser <p>/<h1> margins
   (~1em top+bottom each) go uncorrected as long as .cover's height is
   auto/shrink-to-fit, but once it has a fixed physical height (needed for
   a full-bleed cover image), that unaccounted margin is enough to push
   the last centered line past the section's own bottom edge and onto the
   next page instead of being contained on the cover. */
.cover-title { font-size: 36pt; margin: 0 0 12pt; }
.cover-subtitle { font-size: 18pt; margin: 0 0 24pt; }
.cover-meta { font-size: 12pt; opacity: 0.8; margin: 0 0 8pt; }
.toc ul { list-style: none; padding: 0; }
.toc li { display: flex; align-items: baseline; }
.toc-level-1 { font-weight: 600; margin-top: 8pt; }
.toc-level-2 { margin-left: 16pt; }
.toc-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toc-dots { flex: 1 1 auto; border-bottom: 1px dotted currentColor; margin: 0 4pt; position: relative; top: -3pt; }
.toc-page { white-space: nowrap; }
.content-section { margin-bottom: 18pt; page-break-inside: avoid; }
.content-section.figure svg, .content-section.figure img { max-width: 100%; height: auto; }
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

  // Built twice: once with tocHtmlPass1 (titles only, to measure where each
  // heading actually lands) and again with the real page numbers filled in
  // (see the two-pass render below) -- a function instead of one string so
  // both passes share the exact same wrapper.
  const buildRestHtml = (tocHtml) => `<!DOCTYPE html>
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
  // Front matter alone (legal notice + TOC, no content sections) -- rendered
  // separately just to count how many pages it takes on its own. That count
  // tells computeHeadingPageNumbers where the TOC's own page(s) end, so it
  // doesn't match every heading's title against the TOC page that lists all
  // of them verbatim with no page number yet. Same margins/CSS as the real
  // render, so its page count matches how the front matter paginates inside
  // the full document.
  const frontOnlyHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
${legalHtml}
${tocHtmlPass1}
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
  fs.writeFileSync(coverHtmlPath, coverOnlyHtml);

  const pdfMargin = {
    top: `${cfg.page.margins.top_mm}mm`,
    bottom: `${cfg.page.margins.bottom_mm}mm`,
    left: `${cfg.page.margins.left_mm}mm`,
    right: `${cfg.page.margins.right_mm}mm`,
  };

  const restPdfOptions = {
    format: cfg.page.size,
    margin: pdfMargin,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: pageNumberFooter,
    printBackground: true,
  };
  // Writes html to its own file (see the file:// origin note above), loads
  // it, and prints it -- used for the cover pass above and every "rest"
  // pass below so each one gets a fresh file:// origin.
  const renderHtmlFile = async (html, filename, pdfOptions) => {
    const htmlPath = path.join(tmpDir, filename);
    fs.writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    try {
      await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });
      return await page.pdf(pdfOptions);
    } finally {
      await page.close();
    }
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

    // Two-pass TOC page numbers: pass 1 measures where each heading actually
    // lands (see computeHeadingPageNumbers), pass 2 (below, the real
    // restHtmlPath render) fills those numbers in. Skipped entirely when
    // there's no TOC to number.
    let finalTocHtml = tocHtmlPass1;
    if (cfg.toc.include && tocHeadings.length > 0) {
      const frontPdfBuffer = await renderHtmlFile(frontOnlyHtml, "front-only.html", {
        format: cfg.page.size,
        margin: pdfMargin,
        displayHeaderFooter: false,
        printBackground: true,
      });
      const frontMatterPageCount = (await PDFDocument.load(frontPdfBuffer)).getPageCount();

      const restPdfBufferPass1 = await renderHtmlFile(buildRestHtml(tocHtmlPass1), "rest-pass1.html", restPdfOptions);
      const pageTexts = await extractPageTexts(restPdfBufferPass1);
      const pageNumbers = computeHeadingPageNumbers(pageTexts, tocHeadings, frontMatterPageCount);
      finalTocHtml = renderTocHtml(cfg, tocHeadings, pageNumbers);
    }

    const restPdfBuffer = await renderHtmlFile(buildRestHtml(finalTocHtml), "rest.html", restPdfOptions);

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
