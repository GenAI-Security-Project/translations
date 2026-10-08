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
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

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
  page: { size: "A4", margins: { top_mm: 25, bottom_mm: 25, left_mm: 22, right_mm: 22 }, decoration_image_path: null },
  fonts: {},
  cover: {
    logo_path: null, background_image_path: null, background_image_position: "top",
    kicker_text: null,
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

// Google Fonts' own "cyrillic" subset range (not "cyrillic-ext") -- standard
// modern Russian, Ukrainian Ge/Ka variants, and the No. sign. Every bundled
// font this project uses (Poppins, Barlow) has zero Cyrillic glyphs at all
// -- confirmed directly against Google Fonts' own served CSS, not just this
// project's bundled files, so it's a real gap in the typefaces themselves,
// not a bundling oversight. Verified live against a real ru-RU translation:
// without this, Chrome silently falls back to a generic system serif for
// every Cyrillic character while Latin/digits stay in the real brand font,
// producing a visibly mismatched two-font document with no error or warning
// anywhere in the pipeline.
const CYRILLIC_UNICODE_RANGE =
  "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const CYRILLIC_FALLBACK_FONT = "NotoSans-Variable.ttf";

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
      const weight = file.weight || 400;
      const style = file.style || "normal";
      blocks.push(
        `@font-face { font-family: "${spec.family}"; src: url("${url}"); ` +
        `font-weight: ${weight}; font-style: ${style}; }`
      );
      // Same family name, same weight/style, but scoped to just the
      // Cyrillic range via a variable font that actually has those glyphs
      // -- Chrome picks whichever @font-face matching this family/weight
      // covers the character being drawn, so Latin text still renders in
      // the real brand font and only Cyrillic falls through to this one,
      // with no per-locale config needed on the render_config.json side.
      const cyrillicAbsPath = path.join(templatesRoot, "assets", "fonts", CYRILLIC_FALLBACK_FONT);
      blocks.push(
        `@font-face { font-family: "${spec.family}"; src: url("file://${cyrillicAbsPath}"); ` +
        `font-weight: ${weight}; font-style: ${style}; unicode-range: ${CYRILLIC_UNICODE_RANGE}; }`
      );
    }
  }
  return { faceCss: blocks.join("\n"), googleHrefs };
}

function fontFamilyFor(key, fonts) {
  const spec = fonts[key];
  return spec ? `"${spec.family}"` : (key === "monospace" ? "monospace" : "sans-serif");
}

// cfg.headings (h1/h2/h3, each optionally overriding font/size_pt/color) was
// part of render_config_schema.py's schema from the start but had nothing to
// consume it here -- every heading rendered in the template's own body/
// default color and size instead of the brand's, unnoticed until a template
// actually populated this field for real. Only emits a rule for whichever
// levels cfg.headings actually configures, so a template that only styles
// h1 doesn't force an unstyled h2 override on top of it.
function buildHeadingCss(cfg) {
  const blocks = [];
  for (const [level, spec] of Object.entries(cfg.headings || {})) {
    if (!spec) continue;
    const decls = [];
    if (spec.font) decls.push(`font-family: ${fontFamilyFor(spec.font, cfg.fonts)};`);
    if (spec.size_pt) decls.push(`font-size: ${spec.size_pt}pt;`);
    if (spec.color) decls.push(`color: ${spec.color};`);
    if (decls.length) blocks.push(`.content-section ${level} { ${decls.join(" ")} }`);
    // Not a border-bottom: a border is constrained to the heading box's own
    // width (100%/auto depending on layout), but the real template's rule
    // is a fixed-width line independent of the heading text or box width
    // (see HeadingUnderline's docstring) -- a dedicated block-level ::after
    // with an explicit width guarantees that regardless of how wide the
    // heading itself renders.
    if (spec.underline) {
      const u = spec.underline;
      blocks.push(
        `.content-section ${level}::after { content: ""; display: block; ` +
        `width: ${u.width_pt}pt; height: ${u.thickness_pt}pt; background: ${u.color}; margin-top: 4pt; }`
      );
    }
  }
  return blocks.join("\n");
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
const MM_TO_PT = 2.834645669;

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

// green-cover-background.jpg (the "full" position asset, 2562x3316) is a
// different file from the "top" mode's cover-band.png above: navy band at
// the top, plain white for the rest, same convention, different image and
// different proportions. Measured directly on the real file: the navy-to-
// white transition sits at row 1560 of 3316 (0.4704), checked across
// several columns to avoid landing on one of the lighter decorative
// circles baked into the band itself. Used to compute how far down the
// page the band actually ends once stretched to its rendered height, so
// cover text can start below it instead of overlapping it.
const COVER_FULL_BG_BAND_FRACTION = 0.4704;

function renderCoverHtml(cfg, meta) {
  const logoImg = cfg.cover.logo_path
    ? `<img src="file://${meta.logoAbsPath}" style="max-width: 220px; margin-bottom: 48px;" />`
    : "";
  const versionLine = cfg.cover.show_version ? `<p class="cover-meta cover-meta-version">${meta.version}</p>` : "";
  const dateLine = cfg.cover.show_date ? `<p class="cover-meta cover-meta-date">${meta.date}</p>` : "";
  // The real template's own cover text box: "GENAI SECURITY PROJECT" in
  // accent3, directly above the title -- confirmed from the real .docx
  // (a dedicated text run, not part of the background image). Not
  // locale-specific -- it's the publishing project's own name, not this
  // asset's content, so it isn't translated per locale any more than the
  // logo wordmark baked into the cover image itself is.
  // fontFamilyFor() returns a CSS font-family value that may itself contain
  // literal double quotes (e.g. `"Poppins SemiBold"`) when a spec exists --
  // correct inside a <style> block, but it breaks a double-quoted HTML
  // style="..." attribute (closes the attribute early). These three cover
  // elements are the only places it's interpolated into an inline style
  // attribute rather than a stylesheet, so they use single-quote attribute
  // delimiters instead of escaping the value.
  const kickerHtml = cfg.cover.kicker_text
    ? `<p class="cover-kicker" style='font-family:${fontFamilyFor(cfg.cover.title_font, cfg.fonts)}'>${cfg.cover.kicker_text}</p>`
    : "";

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
  // coverPdfOptions runs this pass at zero Puppeteer margin specifically so
  // the background image can bleed to the true page edge (a non-zero
  // margin reserves space OUTSIDE the HTML viewport entirely -- nothing
  // rendered by this HTML, fixed or flowing, can ever paint there, proven
  // empirically; see coverPdfOptions' own comment) -- so this is now the
  // FULL physical page height, not margin-reduced. The old margin inset is
  // reproduced below as CSS padding on .cover-content instead, for the
  // text only, leaving the background free to fill the whole section.
  const pageHeightMm = PAGE_HEIGHT_MM[cfg.page.size] || PAGE_HEIGHT_MM.A4;

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
  // How far down the page the band itself actually ends, in mm from the
  // section's own top (y=0) -- used below so no text is ever placed over
  // it. "top" mode's box *is* the band (object-fit:cover crops away
  // everything else), so its own rendered height is the clearance. "full"
  // mode stretches the whole source file -- band plus the plain white
  // majority below it -- to heightMm, so the clearance is only the band's
  // own fraction of that, per COVER_FULL_BG_BAND_FRACTION.
  let bandBottomMm = 0;
  if (cfg.cover.background_image_path && meta.coverBgAbsPath) {
    if (cfg.cover.background_image_position === "full") {
      // Full page height, not a fraction of it (was pageHeightMm * 0.82) --
      // on request, so the image itself reaches the true bottom edge with
      // zero margin, the same as it already does on top/left/right,
      // instead of handing the bottom strip off to .cover's own flat
      // background-color fill.
      const heightMm = pageHeightMm;
      bandBottomMm = heightMm * COVER_FULL_BG_BAND_FRACTION;
      // green-cover-background.jpg has a thin baked-in white border on two
      // of its own edges (measured directly on the file: ~4px top, ~7px
      // right, out of 3316x2562px -- left and bottom are clean) -- at
      // width/height:100% that border shows up as a sliver of white at the
      // true page edge instead of true bleed, on exactly those two sides.
      // Cropping it out non-destructively (never touching the source file,
      // same policy as every other asset here): scale the image up by
      // just over that border's own fraction and shift it up, so the
      // border itself lands outside the visible 0%-100% box instead of
      // shrinking what's shown -- not scaling the box down, which would
      // leave a gap on the two clean edges instead. Shifting the box up
      // without also growing its height would pull its BOTTOM edge up by
      // the same amount, short of the true bottom edge by that much (only
      // ever invisible before this image reached full page height in the
      // first place) -- renderedHeightMm adds the offset back so the
      // bottom still lands exactly at pageHeightMm after the shift.
      const topBorderOffsetMm = heightMm * 0.0015; // ~0.15%, safety margin over the measured 0.12%
      const renderedHeightMm = heightMm + topBorderOffsetMm;
      bgLayer = `<img class="cover-bg cover-bg-full" style="height: ${renderedHeightMm}mm; top: -${topBorderOffsetMm}mm;" src="file://${meta.coverBgAbsPath}" alt="">`;
    } else {
      // Full page width now (not width-minus-margins) -- same reasoning as
      // pageHeightMm above: this pass has zero Puppeteer margin, so the
      // image displays at the section's true full width.
      const pageWidthMm = PAGE_WIDTH_MM[cfg.page.size] || PAGE_WIDTH_MM.A4;
      const bandHeightMm = pageWidthMm * COVER_TOP_BAND_RATIO;
      bandBottomMm = bandHeightMm;
      bgLayer = `<img class="cover-bg cover-bg-top" style="height: ${bandHeightMm}mm;" src="file://${meta.coverBgAbsPath}" alt="">`;
    }
  }
  // .cover-content's own padding-top (below) already clears some of this --
  // only the remainder needs to be an explicit margin on the first text
  // block, plus a small breathing-room gap so text doesn't start flush
  // against the band's edge. COVER_CONTENT_PADDING_MM is the original
  // visual inset (unchanged); coverContentPaddingTopMm is what that inset
  // actually is now, with cfg.page.margins.top_mm folded in to replace the
  // Puppeteer margin this pass no longer has -- see .cover-content below.
  const COVER_CONTENT_PADDING_MM = 20;
  const coverContentPaddingTopMm = COVER_CONTENT_PADDING_MM + cfg.page.margins.top_mm;
  const bandClearanceGapMm = 6;
  const topClearanceMm = Math.max(0, bandBottomMm + bandClearanceGapMm - coverContentPaddingTopMm);

  // A short fixed-width rule under the title, matching the real template's
  // own H1 underline exactly (same cfg.headings.h1.underline spec that
  // buildHeadingCss draws under every body H1 -- see HeadingUnderline's
  // docstring: a drawn line, not a border, independent of the heading
  // text's own width) rather than inventing a separate cover-only style.
  const h1Underline = cfg.headings && cfg.headings.h1 && cfg.headings.h1.underline;
  const dividerHtml = h1Underline
    ? `<div class="cover-title-divider" style="width:${h1Underline.width_pt}pt; height:${h1Underline.thickness_pt}pt; background:${h1Underline.color};"></div>`
    : "";

  // The real template anchors the title block around 58% down the page and
  // version/date separately near the very bottom (confirmed from the real
  // .docx's own fixed-position text boxes), left-aligned, not centered and
  // not clustered immediately under the subtitle. Two different attempts at
  // reproducing that exactly -- a fixed mm gap, then flex-grow spacers --
  // each caused the cover's own content to overflow onto page 2 in this
  // print-pagination context, for reasons that didn't reproduce the same
  // way in isolated testing; given overflowing is worse than an inexact
  // proportion, this uses plain, modest margins instead (topClearanceMm,
  // computed above, substitutes for "58% down" with "just below the band,
  // whatever that works out to") -- a real simplification versus the
  // source template, not just an approximation of it, flagged here rather
  // than left undocumented.
  return `
    <section class="page cover" style="background:${cfg.cover.background_color}; color:${cfg.cover.text_color}; position: relative; overflow: hidden; ${sectionHeightStyle}">
      ${bgLayer}
      <div class="cover-content" style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; padding: ${coverContentPaddingTopMm}mm ${COVER_CONTENT_PADDING_MM + cfg.page.margins.right_mm}mm ${COVER_CONTENT_PADDING_MM + cfg.page.margins.bottom_mm}mm ${COVER_CONTENT_PADDING_MM + cfg.page.margins.left_mm}mm;">
        ${logoImg}
        <div class="cover-title-block" style="margin-top: ${topClearanceMm}mm;">
          ${kickerHtml}
          <h1 class="cover-title" style='font-family:${fontFamilyFor(cfg.cover.title_font, cfg.fonts)}'>${meta.title}</h1>
          ${dividerHtml}
          <p class="cover-subtitle" style='font-family:${fontFamilyFor(cfg.cover.subtitle_font, cfg.fonts)}'>${meta.locale}</p>
        </div>
        <div class="cover-meta-block" style="margin-top: 14mm;">
          ${versionLine}
          ${dateLine}
        </div>
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
// tocBackgroundAbsPath, when given, is rendered as a normal flowing <img> --
// NOT position:fixed. A TOC can span multiple printed pages, and Chrome's
// print engine anchors position:fixed to the content viewport (the area
// *inside* the page margin), the same box flowing content starts in --
// confirmed empirically (a minimal repro: inflating the PDF margin pushed a
// position:fixed box and normal content down by the exact same amount, so
// the gap between them never changed). There's no way to make a fixed
// element start at a different point than content on every page of one
// render; a flowing image sidesteps the problem entirely by taking up real
// document-flow space once, on the TOC's first page -- pushing the heading
// below it naturally -- while continuation pages simply have no image to
// collide with, the same way a document's "special first page, plain rest"
// convention normally works.
function renderTocHtml(cfg, tocHeadings, pageNumbers, tocBackgroundAbsPath) {
  if (!cfg.toc.include) return "";
  const items = tocHeadings
    .map((h, i) => {
      const num = pageNumbers ? pageNumbers[i] : null;
      return `<li class="toc-level-${h.level}"><span class="toc-title">${h.text}</span><span class="toc-dots"></span><span class="toc-page">${num || ""}</span></li>`;
    })
    .join("\n");
  // Shown cropped to just the navy band, not the full image -- as flowing
  // content, the image's own white lower ~80% (invisible against the page
  // when it was position:fixed, since it just blended into the page's own
  // white) would otherwise take up real, wasted vertical space pushing the
  // heading/list far down the page. Cropped via CSS (overflow:hidden on a
  // fixed-height wrapper), not by editing the source file -- see
  // translations-templates' own cover-art policy on why.
  const bgImg = tocBackgroundAbsPath
    ? `<div class="toc-background-crop"><img class="toc-background" src="file://${tocBackgroundAbsPath}" alt=""></div>`
    : "";
  // .toc itself has zero padding (overriding the generic .page's 20mm, the
  // same way .cover already does) so the background image can sit flush
  // against the content box's own edges with no margin tricks -- a negative
  // margin was tried first and got silently clipped, since in-flow content
  // can't render above its own box's origin inside a print viewport the way
  // position:absolute/fixed content can. The actual heading/list text goes
  // in its own .toc-inner wrapper, which carries the standard 20mm padding
  // instead, so reading margins stay normal even though .toc's own aren't.
  return `
    <section class="page toc">
      ${bgImg}
      <div class="toc-inner">
        <h2>${cfg.toc.label}</h2>
        <ul>${items}</ul>
      </div>
    </section>`;
}

// The shared sponsors image (see SponsorsConfig's docstring) has no title of
// its own -- it's a clean logo grid, unlike the asset's own per-locale
// figure it replaces, which usually had "Sponsors" baked into the scan as
// part of the image. Without this, the swapped-in page reads as an untitled
// continuation of whatever came before it in every locale. The real title
// text already exists, already translated, in the asset's own figure file
// being replaced -- this just has to find it, which isn't one consistent
// shape across locales:
//   - the original OCR-split convention: a flat `id="t2"` text element
//     (confirmed against the English source: id="t2" is exactly "Sponsors",
//     always at that position, since split time numbers OCR'd lines in
//     reading order and this is always the 3rd line after the two logo
//     wordmark lines).
//   - a hand-rebuilt figure (e.g. ru-RU's, redone with real selectable text
//     instead of an OCR overlay): a semantic `id="title"` text element,
//     whose content may be split across multiple <tspan> children (one per
//     visual line) rather than one flat string.
// Tries both; returns null (title simply omitted, same as before this
// existed) if neither is present, rather than guessing from position/order
// in a layout that varies per locale.
function extractSponsorsTitle(svgText) {
  const flat = svgText.match(/<text id="t2"[^>]*>([^<]*)<\/text>/);
  if (flat) return flat[1].replace(/\*\*/g, "").trim();

  const titleBlock = svgText.match(/<text id="title"[^>]*>([\s\S]*?)<\/text>/);
  if (titleBlock) {
    const lines = [...titleBlock[1].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]);
    const text = (lines.length ? lines.join(" ") : titleBlock[1]).replace(/<[^>]+>/g, "").replace(/\*\*/g, "").trim();
    if (text) return text;
  }
  return null;
}

// The real, already-translated intro text -- the sponsorship-program
// paragraph(s) (financial support, project independence, no governance
// rights for sponsors) and the short "Sponsors:" sub-heading that
// originally introduced the logo grid -- baked into this asset's own
// sponsors/acknowledgements figure, same as extractSponsorsTitle's own
// title. Until now only the title was ever read out of it, leaving the
// swapped-in shared logo image sitting under a bare title with no intro --
// this is the same standard boilerplate on every sponsors page across
// every published document (confirmed by reading the real content: the
// financial-support/independence/no-governance-rights language is
// identical in substance across locales, just translated), so it's read
// from here rather than invented, the only place a real, already-reviewed
// translation of it exists per locale -- see SponsorsConfig's own
// docstring on why only the logo IMAGE is shared/untranslated, not this text.
function extractSponsorsBody(svgText) {
  // Replaces every tag (not just top-level <tspan>s) with a space, rather
  // than matching <tspan> specifically -- a real p2 was found to wrap an
  // inline link in its own <a><tspan>...</tspan></a>, nested inside one of
  // the line-wrap tspans; matching only non-nested <tspan>...</tspan> pairs
  // both skipped that tspan's own plain-text portions (anything is before
  // or after the nested link) AND separately re-matched the nested tspan
  // on its own, reordering/duplicating text. Tag-agnostic space-replacement
  // handles arbitrary nesting (a link, bold, whatever) uniformly: every
  // wrapped line and every inline sub-element just becomes a space-joined
  // run of plain text, closest to how it actually reads.
  const byId = (id) => {
    const m = svgText.match(new RegExp(`<text id="${id}"[^>]*>([\\s\\S]*?)<\\/text>`));
    if (!m) return null;
    const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
    return text || null;
  };
  if (svgText.includes('id="p1"') || svgText.includes('id="title"')) {
    return { paragraphs: [byId("p1"), byId("p2")].filter(Boolean), heading: byId("sponsors-heading") };
  }
  // Flat OCR convention: one <text id="tN"> per visual line, in reading
  // order, no semantic ids -- grouped by font-size instead, the one cue
  // that reliably marks each role across every real file checked: title
  // lines measure 106-160pt, body paragraph lines 37-55pt, and the
  // "Sponsors:" sub-heading that follows the paragraph sits at ~78pt,
  // clearly between the two. Skips past the leading title-sized run first
  // (extractSponsorsTitle's own t2-only shortcut only grabs one of those
  // lines for the title itself; this doesn't need to match that, just skip
  // all of them), then collects the body run, then reads one more line as
  // the heading.
  const lines = [...svgText.matchAll(/<text id="t(\d+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([, , size, text]) => ({ size: Number(size), text: text.replace(/\*\*/g, "").trim() }));
  let i = 0;
  while (i < lines.length && lines[i].size > 80) i++; // skip the title run
  const body = [];
  while (i < lines.length && lines[i].size <= 60) { body.push(lines[i].text); i++; }
  const heading = i < lines.length && lines[i].size > 60 ? lines[i].text : null;
  return { paragraphs: body.length ? [body.join(" ")] : [], heading };
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
    // sponsorlogo/ -- uploaded directly to translations-templates's main,
    // superseding any asset's own sponsors figure for all published
    // translations (explicit instruction, 2026-10-01). Org-roster content
    // that changes on its own schedule, independent of any template/brand
    // asset. Every render resolves whatever file is currently there, so
    // replacing it (a PR in translations-templates, no code change here) is
    // all that's needed for every future render to pick up the new roster.
    ? path.join(args.templatesRoot, "sponsorlogo", cfg.sponsors.image_path)
    : null;

  // Cover, TOC, and every-other-page decoration images all live directly in
  // this template's own folder (translations-templates/<template>/) -- a
  // per-template asset, not a shared one, confirmed by the real files
  // provided for green-template (blue/yellow are expected to carry their
  // own, similarly-named files, not share green's).
  const templateDir = path.join(args.templatesRoot, assetEntry.template);

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

  // A page that's entirely one diagram, split the same automated way as
  // every other page: a "<Base>" text section (the page's own text in
  // whatever order OCR/extraction produced) plus a "<Base>_Figure_N"
  // scanned image. For a normal two-column or prose page that split
  // produces a real paragraph; for a page that IS the diagram, there's no
  // prose to extract, so the "text" section is just the diagram's own
  // on-image labels (ASI01, "Inputs", "Outputs", ...) concatenated in scan
  // order -- confirmed by reading the real _source file: a jumble of short
  // label fragments, not a sentence anywhere, identical in kind across
  // every locale since every translator translated that same garbled
  // English source. hasTextSibling below (correctly, for every OTHER
  // figure) treats a same-named .md as proof the figure is a redundant
  // scan and drops the figure -- backwards here, where the .md is the
  // noise and the figure is the only real content. Unlike Preface_Figure
  // (no real heading to preserve, skipped outright above), this page's own
  // first line IS a real, correctly-translated title, so only the garbled
  // body is dropped -- the heading stays and the real diagram renders in
  // its place.
  const DIAGRAM_ONLY_SECTIONS = new Set(["agentic_top_10_at_a_glance"]);

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

    // The source document's own scanned title/cover page -- OWASP branding,
    // title, version, date, all baked into one raster image with OCR text
    // overlaid. This renderer builds its own authoritative cover from
    // cfg.cover (sourced from translations-templates, not the uploaded
    // document), so shipping the source's own leftover cover scan as a body
    // section is always wrong -- observed in practice landing several pages
    // into the document (after the real cover + TOC), looking like stray,
    // wrongly-placed, wrongly-sourced branding. There's no "Preface" text
    // sibling to generalize this from (see hasTextSibling below), so it's
    // matched by name, the same way table_of_contents? is just above.
    if (/^preface_figure$/i.test(name)) continue;

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
      // The shared image itself has no title or intro text baked in
      // (unlike the asset's own figure it replaces) -- recover the real,
      // already-translated title, intro paragraph(s), and "Sponsors:"
      // sub-heading from that figure's own file so the page the reader
      // sees isn't a bare, untitled, unexplained logo grid in every
      // locale. See extractSponsorsTitle's and extractSponsorsBody's own
      // docstrings for why this isn't just "the first <text> element."
      const sponsorsSvgText = fs.readFileSync(svgPath, "utf-8");
      const sponsorsTitle = extractSponsorsTitle(sponsorsSvgText);
      const sponsorsBody = extractSponsorsBody(sponsorsSvgText);
      // This text is this asset's own translated content (unlike the
      // swapped-in image), so it counts toward the authenticity checksum
      // like any other translated text would.
      const checksumParts = [sponsorsTitle, ...sponsorsBody.paragraphs, sponsorsBody.heading].filter(Boolean);
      for (const part of checksumParts) rawContentParts.push(part);
      // h1, not h2 -- matches every other section's own top-level title
      // (e.g. "ASI01: ..."), including the underline rule .content-section
      // h1::after already draws for every h1 via buildHeadingCss/cfg.headings.h1,
      // with no extra CSS needed here since this is already inside a real
      // .content-section.
      const titleHtml = sponsorsTitle ? `<h1>${sponsorsTitle}</h1>` : "";
      const paragraphsHtml = sponsorsBody.paragraphs.map((p) => `<p>${p}</p>`).join("");
      const headingHtml = sponsorsBody.heading ? `<p><strong>${sponsorsBody.heading}</strong></p>` : "";
      // Always starts its own page -- see .content-section.new-page's own
      // comment -- rather than landing wherever it falls after whatever
      // Acknowledgements content happens to precede it.
      sectionsHtml.push(`<section class="content-section figure new-page">${titleHtml}${paragraphsHtml}${headingHtml}<img src="file://${sponsorsImageAbsPath}" alt="Sponsors"></section>`);
      continue; // the image itself is a shared template asset, not this asset's own content -- excluded from the content checksum below
    }

    if (fs.existsSync(mdPath)) {
      // Every section file leads with a <!-- status: draft|reviewed|... -->
      // banner for GitHub PR review -- pipeline metadata, not content; with
      // HTML parsing off, markdown-it would otherwise print it as literal text.
      const raw = fs.readFileSync(mdPath, "utf-8").replace(/^<!--\s*status:.*?-->\n?/, "");
      if (DIAGRAM_ONLY_SECTIONS.has(name.toLowerCase())) {
        // Keep only the real, correctly-translated H1 -- see
        // DIAGRAM_ONLY_SECTIONS' own comment for why the rest of this file
        // is garbled OCR labels, not prose, and gets dropped entirely. The
        // actual diagram renders via this name's own "_Figure_N" sibling
        // below, which hasTextSibling lets through for exactly this set.
        const headingMatch = raw.match(/^#\s+(.+)$/m);
        if (headingMatch) {
          rawContentParts.push(headingMatch[0]);
          sectionsHtml.push(`<section class="content-section">${md.render(headingMatch[0])}</section>`);
        }
      } else {
        rawContentParts.push(raw);
        // Project_Supporters, specifically (not any other plain-text
        // section): always starts its own page, the same standing,
        // template-level treatment the Sponsors figure gets above and for
        // the same reason -- see .content-section.new-page's own comment.
        const sectionClass = name.toLowerCase() === "project_supporters" ? "content-section new-page" : "content-section";
        sectionsHtml.push(`<section class="${sectionClass}">${md.render(raw)}</section>`);
      }
    } else if (fs.existsSync(svgPath)) {
      const svg = fs.readFileSync(svgPath, "utf-8");
      const firstOcrText = svg.match(/<text[^>]*>([^<]*)<\/text>/);
      const isDuplicateTocScan = tocHeadingText && firstOcrText && normalizeForMatch(firstOcrText[1]) === tocHeadingText;
      // Split-time convention for a page that had a complex visual layout:
      // the manifest gets BOTH a "<Base>" text section (the page's own text,
      // read in whatever order OCR/PDF-text-extraction produced) AND a
      // separate "<Base>_Figure" or "<Base>_Figure_N" scanned-image section
      // for the same page. The text section already carries the real,
      // translated copy; the "_Figure" one is just that same page's raster
      // scan -- background texture, stale source-document styling and all --
      // with OCR text overlaid at its original pixel position. Per explicit
      // instruction, this renderer must draw only from translations-templates
      // and the translated copy, never from the uploaded document's own
      // scanned artwork, so whenever that text sibling exists, the scan is
      // always the redundant one and is dropped, keeping just the copy.
      const figureSuffixMatch = name.match(/^(.*)_Figure(?:_\d+)?$/i);
      const hasTextSibling = figureSuffixMatch
        && !DIAGRAM_ONLY_SECTIONS.has(figureSuffixMatch[1].toLowerCase())
        && fs.existsSync(path.join(localeDir, `${figureSuffixMatch[1]}.md`));
      if (isDuplicateTocScan || hasTextSibling) continue;
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
  const headingCss = buildHeadingCss(cfg);
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
      ? path.join(templateDir, cfg.cover.background_image_path)
      : null,
  });
  const legalHtml = renderLegalNoticeHtml(cfg);
  const tocHeadings = headings.filter((h) => h.level <= cfg.toc.max_depth);
  // The TOC's own distinct background -- a real, different image from both
  // the cover's and every other page's (see TocConfig.background_image_path's
  // docstring). Passed into renderTocHtml, which renders it as flowing
  // content rather than a position:fixed overlay -- see that function's own
  // comment for why.
  const tocBackgroundAbsPath = cfg.toc.background_image_path
    ? path.join(templateDir, cfg.toc.background_image_path)
    : null;
  const tocHtmlPass1 = renderTocHtml(cfg, tocHeadings, null, tocBackgroundAbsPath);

  // Every page EXCEPT the cover and the TOC gets this light corner
  // decoration -- a genuinely different image from both the cover's own
  // band and the TOC's own background, confirmed against the real .docx
  // (see PageConfig.decoration_image_path's docstring). Legal and body keep
  // their normal non-zero Puppeteer margin (their pagination/footer logic
  // is exactly the fragile, heavily-tuned part of this pipeline that a
  // margin change would put at risk), so this can't be a position:fixed
  // HTML overlay the way the watermark/tracking-stamp are -- that would
  // still be confined to the margin-inset viewport, the same bleed problem
  // being fixed everywhere else. Instead it's composited directly onto the
  // final PDF pages with pdf-lib after the merge below: each legal/body
  // page is rebuilt as a blank page the image is drawn onto first (true
  // page bounds, no margin involved), with the already-rendered Puppeteer
  // page embedded on top of it. That only works because a Puppeteer page
  // with no explicit background-color is genuinely transparent outside its
  // actual marks (confirmed empirically before writing this), so the text
  // comes through untouched and the image only shows in the true margin
  // strip around it that Puppeteer's own content never reached.
  const pageDecorationAbsPath = cfg.page.decoration_image_path
    ? path.join(templateDir, cfg.page.decoration_image_path)
    : null;

  const googleLinkTags = googleHrefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");

  // The cover title is an h1 like any other -- it must never exceed the
  // same 30pt ceiling cfg.headings.h1.size_pt sets for content headings,
  // regardless of what a template's own cover styling might otherwise ask
  // for. Capped (not just defaulted) so a template config that specifies a
  // larger value for either can't push the cover title past it either.
  const H1_MAX_SIZE_PT = 30;
  // The cover title specifically (not body H1s -- cfg.headings.h1 and
  // H1_MAX_SIZE_PT above are unchanged) renders smaller than a body H1 by
  // request: 30% smaller than the capped size.
  const COVER_TITLE_SCALE = 0.7;
  const coverTitleSizePt = Math.min(
    (cfg.headings.h1 && cfg.headings.h1.size_pt) || H1_MAX_SIZE_PT,
    H1_MAX_SIZE_PT
  ) * COVER_TITLE_SCALE;

  const sharedHead = `
<meta charset="utf-8">
<title>${assetEntry.title || args.asset} -- ${args.locale}</title>
${googleLinkTags}
<style>
${faceCss}
* { box-sizing: border-box; }
body {
  /* The browser's default ~8px body margin was always here, just harmless
     slack absorbed by Puppeteer's own (much larger) margin. Now that the
     cover/TOC passes run at zero Puppeteer margin with a section sized to
     EXACTLY the physical page height (see renderCoverHtml's pageHeightMm),
     that unaccounted ~2.1mm pushes the section's box past the true page
     edge and spills a second, near-blank page -- confirmed by this exact
     symptom appearing once those two passes went to zero margin. */
  margin: 0;
  font-family: ${fontFamilyFor("body", cfg.fonts)};
  direction: ${cfg.direction};
  line-break: ${cfg.line_breaking.line_break};
  word-break: ${cfg.line_breaking.word_break};
  word-spacing: ${cfg.line_breaking.word_spacing === "none" ? "-0.05em" : "normal"};
  ${cfg.line_breaking.hyphens === "auto" ? `hyphens: auto; -webkit-hyphens: auto;` : "hyphens: none;"}
  ${cfg.line_breaking.hyphens_lang ? `` : ""}
}
.page { page-break-after: always; padding: 20mm; }
.cover { height: 100%; text-align: left; padding: 0; }
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
/* width:100.5% (not 100%) crops the source file's own ~7px right-edge
   border the same way the inline top offset crops its ~4px top-edge
   border (see that comment) -- the extra 0.5% pushes past the true right
   edge, taking the border past the viewport's own visible 0-100% box with
   it, rather than leaving a thinner image not actually reaching the edge. */
.cover-bg-full { width: 100.5%; object-fit: fill; }
/* Explicit margin resets throughout -- default browser <p>/<h1> margins
   (~1em top+bottom each) go uncorrected as long as .cover's height is
   auto/shrink-to-fit, but once it has a fixed physical height (needed for
   a full-bleed cover image), that unaccounted margin is enough to push
   the last centered line past the section's own bottom edge and onto the
   next page instead of being contained on the cover. Sizes/colors below
   match the real template's own named cover styles exactly (confirmed
   from the real .docx's styles.xml): kicker 19pt bold accent3, title
   capped at H1_MAX_SIZE_PT regardless of the template's own 34pt default
   (explicit instruction, see that constant's own comment), subtitle 18pt,
   version 13pt, date 9pt -- version and date are two different sizes in
   the real template, not one shared size. */
.cover-title-block { text-align: left; }
/* font-variant:small-caps renders this run's own lowercase letters as
   small uppercase while leaving its actual uppercase letters full-height --
   requires the source text to already be mixed case ("GenAI Security
   Project" in render_config.json), not literal ALL CAPS, or there's no
   lowercase left for it to visibly act on. */
.cover-kicker { font-size: 19pt; font-weight: 700; color: #9FAEB5; margin: 0 0 6pt; font-variant: small-caps; letter-spacing: 0.02em; }
.cover-title { text-align: left; font-size: ${coverTitleSizePt}pt; margin: 0 0 8pt; }
.cover-title-divider { margin: 0 0 14pt; }
.cover-subtitle { text-align: left; font-size: 18pt; margin: 0; }
.cover-meta { text-align: left; margin: 0 0 4pt; }
.cover-meta-version { font-size: 13pt; }
.cover-meta-date { font-size: 9pt; }
.toc ul { list-style: none; padding: 0; }
.toc li { display: flex; align-items: baseline; }
.toc-level-1 { font-weight: 600; margin-top: 8pt; }
.toc-level-2 { margin-left: 16pt; }
.toc-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toc-dots { flex: 1 1 auto; border-bottom: 1px dotted currentColor; margin: 0 4pt; position: relative; top: -3pt; }
.toc-page { white-space: nowrap; }
.content-section { margin-bottom: 18pt; page-break-inside: avoid; }
.content-section.figure svg, .content-section.figure img { max-width: 100%; height: auto; }
/* Sponsors and Project Partners/Supporters each start their own fresh page
   rather than landing wherever they happen to fall in the continuous body
   flow (which could be mid-page, right after whatever the previous section
   ended with) -- these are standing, template-level pages by design (the
   sponsors content especially -- a swapped-in shared logo image, not this
   asset's own translated content), not just another body section that
   happens to come next in reading order. */
.content-section.new-page { page-break-before: always; }
/* A heading is never left stranded near the bottom of a page: if there's
   room for a heading but not for anything meaningfully following it, print
   pagination naturally treats the heading as the last thing on that page --
   page-break-after: avoid tells Chrome to instead push the heading (and
   whatever comes right after it) onto the next page as a unit. This is the
   standard CSS mechanism for the "orphan heading" problem and, unlike a
   fixed bottom-of-page fraction, holds regardless of how tall the
   surrounding content or margins happen to be for a given locale/template. */
.content-section h1, .content-section h2, .content-section h3 {
  page-break-after: avoid;
  page-break-inside: avoid;
}
${headingCss}
${watermarkCss}
.tracking-stamp {
  position: fixed; left: 0; bottom: 3mm; width: 100%; text-align: center;
  font-family: sans-serif; font-size: 5pt; letter-spacing: 0.2px;
  color: #000000; opacity: 0.12; pointer-events: none; z-index: 9998;
  white-space: nowrap;
}
/* Flowing content, not position:fixed -- see renderTocHtml's own comment
   for why a fixed TOC background can't work across a multi-page TOC.
   .toc itself has padding:0 (below) so this sits flush against the content
   box's own edges, no margin trick needed (one was tried first and
   silently clipped -- in-flow content can't render above its own box's
   origin in a print viewport). Cropped to just the navy band via the
   padding-top percentage-box technique (height:0 + padding-top:<percent>
   + overflow:hidden, with the image absolutely positioned inside) rather
   than shown at its full natural height -- see renderTocHtml's comment for
   why: the real green-toc-background.png's navy portion measures 525 of
   2770px tall at 2550px wide, so cropping to 525/2550 = 20.59% of the
   crop box's own width reproduces that regardless of how wide the content
   box actually renders (page size/margins), the same way the cover's own
   COVER_TOP_BAND_RATIO works. The heading/list that follow in document
   order are pushed down by this (now-bounded) height, automatically, on
   whichever page the image lands. */
.toc { padding: 0; }
/* left:-1mm + width:calc(100% + 2mm), not a plain 0/100% -- at exactly
   zero Puppeteer margin, Chromium's print layout leaves a sub-pixel
   rounding gap (roughly 2px at 200dpi, ~0.25mm) on this box's own left
   edge specifically, measured directly in the rendered PDF and NOT
   present on the cover's background (a plainer, unnested position:absolute
   image) -- nesting inside this crop wrapper's own percentage-padding box
   is the one structural difference, and is the likely source. A small
   symmetric overscan, the same fix pattern as the cover's own baked-in
   source-file border (see that comment), closes it regardless of exact
   cause: 1mm is well past the rounding error itself, small enough to be
   invisible against a crop this size, and overscanning both edges keeps
   the crop centered rather than shifting it. */
.toc-background-crop {
  position: relative; left: -1mm; width: calc(100% + 2mm); height: 0; padding-top: 20.59%; overflow: hidden;
}
.toc-background {
  position: absolute; top: 0; left: 0; display: block; width: 100%; height: auto;
}
/* Top/right/left: 20mm matches the content's previous visual inset under
   the old non-zero Puppeteer margin; now that top/left/right run at zero
   Puppeteer margin (see tocPdfOptions) so the background can bleed to the
   true page edge on those three sides, this padding alone has to
   reproduce that inset -- the old 20mm PLUS cfg.page.margins, not just
   cfg.page.margins alone. Top is additionally halved (on request) versus
   that formula -- this is the only gap between the background image's own
   bottom edge and the "Table of Content" heading that follows it, since
   .toc-background-crop sits outside .toc-inner as a sibling, flush
   against .toc's own top.
   Bottom is different: tocPdfOptions keeps a real, non-zero Puppeteer
   bottom margin (the background never needs to bleed there), so this is
   just the plain 20mm on its own, not compensated -- Puppeteer's own
   margin already repeats the rest of the inset on every physical page,
   something this padding alone cannot do for a single continuously-
   flowing box BY DEFAULT -- CSS fragmentation's box-decoration-break
   defaults to "slice": padding-top only shows on the fragment where the
   box starts, padding-bottom only on the fragment where it ends, nothing
   repeats on fragments in between (confirmed the hard way: a bottom
   padding that wasn't repeating let text run into the footer/tracking-
   stamp zone on an intermediate page once a smaller top padding let more
   fit above it -- see tocPdfOptions' own comment on the bottom half of
   that fix). box-decoration-break:clone below switches this box to the
   other fragmentation mode, where every fragment gets its own full
   padding -- confirmed empirically in an isolated multi-page test before
   relying on it -- which both keeps the bottom protection repeating AND
   gives a continuation TOC page (one with no background image of its own)
   the same top breathing room as the first page gets below its band,
   instead of starting flush against the true page edge. */
.toc-inner {
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  padding: ${(20 + cfg.page.margins.top_mm) * 0.5}mm ${20 + cfg.page.margins.right_mm}mm
           20mm ${20 + cfg.page.margins.left_mm}mm;
}
</style>`;

  const bodyAttrs = cfg.line_breaking.hyphens_lang ? ` lang="${cfg.line_breaking.hyphens_lang}"` : "";

  const footerUrlHtml = cfg.footer.show_url
    ? (cfg.footer.url_href
        ? `<a href="${cfg.footer.url_href}" style="color:inherit; text-decoration:none;">${cfg.footer.url_text}</a>`
        : cfg.footer.url_text)
    : "";

  // Rendered as four separate HTML->PDF passes -- cover, legal notice, TOC,
  // body -- rather than one combined "rest" document, because the TOC needs
  // its own background image that must never appear on the legal-notice or
  // body pages (see TocConfig.background_image_path's docstring); a single
  // shared stylesheet/body can't scope a position:fixed background to only
  // some of its own pages. The cover isn't "page 1" the way a reader counts
  // pages (a common convention), so it alone gets no footer.
  const coverOnlyHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${coverHtml}
</body>
</html>`;

  const legalOnlyHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${legalHtml}
</body>
</html>`;

  // Built twice: once with tocHtmlPass1 (titles only, to measure where each
  // heading actually lands in the body pass below) and again with the real
  // page numbers filled in -- a function instead of one string so both
  // passes share the exact same wrapper.
  // tocPdfOptions keeps a real, non-zero Puppeteer bottom margin (only
  // top/left/right are zeroed, for the background's bleed -- see that
  // constant's own comment), so the native footerTemplate still has a
  // margin box to render into here; no HTML-based replacement needed.
  const buildTocOnlyHtml = (tocHtml) => `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${tocHtml}
</body>
</html>`;

  // Content sections never depend on the TOC's own page numbers (only the
  // reverse), so unlike the TOC this renders exactly once.
  const bodyOnlyHtml = `<!DOCTYPE html>
<html lang="${args.locale}" dir="${cfg.direction}">
<head>${sharedHead}</head>
<body${bodyAttrs}>
<div class="tracking-stamp">${trackingText}</div>
${watermarkHtml}
${sectionsHtml.join("\n")}
</body>
</html>`;

  // URL only -- Chrome's own pageNumber/totalPages footer-template counters
  // reset to 1 for every separate page.pdf() call, so they can't produce a
  // number that's continuous across four separate renders on their own. The
  // page NUMBER half is instead drawn with pdf-lib after merging, once the
  // absolute sequence (legal, then TOC, then body) is known -- see below.
  const urlOnlyFooter = `<div style="font-size:8pt; width:100%; padding:0 10mm;"><span>${footerUrlHtml}</span></div>`;

  // page.setContent() gives the page no real origin, and Chrome refuses
  // file:// font/image loads from a page with no origin -- fonts silently
  // fall back to a generic serif/sans and <img src="file://..."> renders
  // blank, with no error surfaced anywhere. Writing each HTML doc to a real
  // file and page.goto()-ing it gives the page an actual file:// origin,
  // under which same-machine file:// resource loads work normally.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-"));

  const pdfMargin = {
    top: `${cfg.page.margins.top_mm}mm`,
    bottom: `${cfg.page.margins.bottom_mm}mm`,
    left: `${cfg.page.margins.left_mm}mm`,
    right: `${cfg.page.margins.right_mm}mm`,
  };

  const footeredPdfOptions = {
    format: cfg.page.size,
    margin: pdfMargin,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: urlOnlyFooter,
    printBackground: true,
  };
  // Puppeteer's margin option reserves space OUTSIDE the HTML's own
  // rendering viewport entirely -- confirmed empirically earlier (a
  // position:fixed element shifts by exactly the margin's own inflation,
  // proving zero relative separation is achievable any other way). That
  // means a background image can NEVER bleed to the true physical page
  // edge while this is non-zero, no matter what CSS says. Cover and TOC
  // are each self-contained, isolated passes (cover is always exactly one
  // page; the TOC's own background only ever applies to its first page by
  // design -- see renderTocHtml), so zeroing their margin and moving the
  // former margin inset into CSS padding on their own text content is a
  // locally-contained change. Legal/body are NOT given this treatment --
  // see the page-decoration pdf-lib compositing step after the merge below
  // for how those two keep their margin, pagination, and footer completely
  // unchanged while still getting a full-bleed decoration image.
  const zeroMargin = { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" };
  const coverPdfOptions = {
    format: cfg.page.size,
    margin: zeroMargin,
    displayHeaderFooter: false,
    printBackground: true,
  };
  // Only top/left/right are zeroed -- the TOC's own background image only
  // ever needs to bleed at the top (where the band is) and the full width
  // (left/right), never the bottom. Keeping a real, non-zero bottom margin
  // restores Puppeteer's native per-page-repeating footer box, which a
  // single CSS padding value on .toc-inner cannot replicate: that padding
  // only takes effect once, at the very end of the whole flowing TOC, not
  // on every physical page it's paginated across -- confirmed the hard way
  // when a smaller .toc-inner top padding (see topPaddingMm below) let more
  // entries fit per page, and without a repeating bottom reservation their
  // text ran straight into the footer/tracking-stamp zone on an
  // intermediate TOC page. displayHeaderFooter/footerTemplate are back too,
  // for the same reason -- the native mechanism needs real margin.bottom
  // space to render into, which this now has again.
  const tocPdfOptions = {
    format: cfg.page.size,
    margin: { top: "0mm", left: "0mm", right: "0mm", bottom: `${cfg.page.margins.bottom_mm}mm` },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: urlOnlyFooter,
    printBackground: true,
  };
  // Writes html to its own file (see the file:// origin note above), loads
  // it, and prints it -- used for every pass below so each one gets a fresh
  // file:// origin.
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
    const coverPdfBuffer = await renderHtmlFile(coverOnlyHtml, "cover.html", coverPdfOptions);
    const legalPdfBuffer = await renderHtmlFile(legalOnlyHtml, "legal.html", footeredPdfOptions);
    const legalPageCount = (await PDFDocument.load(legalPdfBuffer)).getPageCount();

    const tocPass1PdfBuffer = (cfg.toc.include && tocHeadings.length > 0)
      ? await renderHtmlFile(buildTocOnlyHtml(tocHtmlPass1), "toc-pass1.html", tocPdfOptions)
      : null;
    const tocPageCount = tocPass1PdfBuffer ? (await PDFDocument.load(tocPass1PdfBuffer)).getPageCount() : 0;

    const bodyPdfBuffer = await renderHtmlFile(bodyOnlyHtml, "body.html", footeredPdfOptions);

    // Two-pass TOC page numbers: pass 1 (above) measures where each heading
    // actually lands in the body; this fills the real numbers in and
    // re-renders the TOC alone. Skipped entirely when there's no TOC.
    let tocFinalPdfBuffer = tocPass1PdfBuffer;
    if (tocPass1PdfBuffer) {
      const bodyPageTexts = await extractPageTexts(bodyPdfBuffer);
      // 0: the body PDF's own pages start at its own page 1, with no
      // legal/TOC pages mixed in (each is a separate PDF now) -- the
      // absolute page number a reader sees is this relative index plus
      // however many legal+TOC pages precede the body.
      const relativePageNumbers = computeHeadingPageNumbers(bodyPageTexts, tocHeadings, 0);
      const absolutePageNumbers = relativePageNumbers.map((n) => (n === null ? null : n + legalPageCount + tocPageCount));
      const finalTocHtml = renderTocHtml(cfg, tocHeadings, absolutePageNumbers, tocBackgroundAbsPath);
      // tocPageCount is assumed stable between the provisional and final TOC
      // (filling in page numbers doesn't change the TOC's own layout height)
      // -- the same assumption the pre-split single-pass version made.
      tocFinalPdfBuffer = await renderHtmlFile(buildTocOnlyHtml(finalTocHtml), "toc-final.html", tocPdfOptions);
    }

    // Merge in document order: cover, legal notice, TOC, body.
    const mergedDoc = await PDFDocument.create();
    const copyAllPages = async (buf) => {
      if (!buf) return;
      const src = await PDFDocument.load(buf);
      for (const p of await mergedDoc.copyPages(src, src.getPageIndices())) mergedDoc.addPage(p);
    };

    // Legal and body keep their normal non-zero Puppeteer margin (see
    // pageDecorationAbsPath's own comment for why), so their rendered pages
    // can't show a true full-bleed decoration image on their own -- it's
    // composited here instead: embed the decoration once, then for each
    // page, draw it onto a blank page at the TRUE page corner first, and
    // the already-rendered Puppeteer page (embedded as a reusable XObject)
    // on top of that. This only works because a Puppeteer page with no
    // explicit background-color has no fill at all outside its actual
    // marks -- confirmed empirically before writing this -- so the text
    // comes through untouched and the image only shows in the true margin
    // strip Puppeteer's own content never reached.
    let decorationImage = null;
    let decorationWidthPt = 0;
    let decorationHeightPt = 0;
    if (pageDecorationAbsPath) {
      // pdf-lib's embedders build a DataView directly over Buffer.buffer
      // without accounting for Buffer.byteOffset -- for a small file,
      // Node's Buffer pool can hand back a view that doesn't start at
      // offset 0 of its underlying ArrayBuffer, so the embedder silently
      // reads from the wrong place and throws "SOI not found in JPEG" (or
      // misreads a PNG). A fresh copy via Uint8Array.from guarantees its
      // own ArrayBuffer starting at offset 0, sidestepping the bug.
      const imgBytes = Uint8Array.from(fs.readFileSync(pageDecorationAbsPath));
      const ext = path.extname(pageDecorationAbsPath).toLowerCase();
      decorationImage = ext === ".png"
        ? await mergedDoc.embedPng(imgBytes)
        : await mergedDoc.embedJpg(imgBytes);
      decorationWidthPt = 100 * MM_TO_PT; // matches the old CSS width:100mm
      decorationHeightPt = decorationWidthPt * (decorationImage.height / decorationImage.width);
    }
    const copyPagesWithDecoration = async (buf) => {
      if (!buf) return;
      const srcDoc = await PDFDocument.load(buf);
      const embeddedPages = await mergedDoc.embedPdf(buf, srcDoc.getPageIndices());
      for (const ep of embeddedPages) {
        const newPage = mergedDoc.addPage([ep.width, ep.height]);
        if (decorationImage) {
          newPage.drawImage(decorationImage, {
            x: ep.width - decorationWidthPt,
            y: ep.height - decorationHeightPt,
            width: decorationWidthPt,
            height: decorationHeightPt,
          });
        }
        newPage.drawPage(ep, { x: 0, y: 0, width: ep.width, height: ep.height });
      }
    };
    // The TOC's first page carries its own distinct background band, so it
    // stays plain (copyAllPages-style, no decoration drawn over the band).
    // Continuation pages, when the TOC spans more than one, have no
    // background of their own -- they get the same standard page
    // decoration every other content page gets, instead of being the one
    // page type left bare. .toc-inner's box-decoration-break:clone (see
    // its own comment) is what gives those continuation pages real top
    // breathing room to go with it, since this decoration is only a
    // composited visual and doesn't push document flow down the way the
    // first page's band does.
    const copyTocPages = async (buf) => {
      if (!buf) return;
      const srcDoc = await PDFDocument.load(buf);
      const [firstIndex, ...restIndices] = srcDoc.getPageIndices();
      const [firstEmbedded] = await mergedDoc.embedPdf(buf, [firstIndex]);
      const firstPage = mergedDoc.addPage([firstEmbedded.width, firstEmbedded.height]);
      firstPage.drawPage(firstEmbedded, { x: 0, y: 0, width: firstEmbedded.width, height: firstEmbedded.height });
      if (!restIndices.length) return;
      const restEmbedded = await mergedDoc.embedPdf(buf, restIndices);
      for (const ep of restEmbedded) {
        const newPage = mergedDoc.addPage([ep.width, ep.height]);
        if (decorationImage) {
          newPage.drawImage(decorationImage, {
            x: ep.width - decorationWidthPt,
            y: ep.height - decorationHeightPt,
            width: decorationWidthPt,
            height: decorationHeightPt,
          });
        }
        newPage.drawPage(ep, { x: 0, y: 0, width: ep.width, height: ep.height });
      }
    };

    await copyAllPages(coverPdfBuffer);
    await copyPagesWithDecoration(legalPdfBuffer);
    await copyTocPages(tocFinalPdfBuffer);
    await copyPagesWithDecoration(bodyPdfBuffer);

    // The page NUMBER half of the footer (the URL half already came from
    // Puppeteer above), drawn once the absolute page sequence across all
    // four passes is known, onto every page except the cover. Position
    // approximates Puppeteer's own footerTemplate layout (bottom margin,
    // right-aligned) with a standard pdf-lib font rather than reusing
    // Chrome's exact font metrics -- see the file-level note on why this
    // can't just be Puppeteer's own pageNumber span.
    if (cfg.footer.show_page_numbers) {
      const numberFont = await mergedDoc.embedFont(StandardFonts.Helvetica);
      const totalNumberedPages = mergedDoc.getPageCount() - 1; // excludes the cover
      const pageWidthPt = (PAGE_WIDTH_MM[cfg.page.size] || PAGE_WIDTH_MM.A4) * MM_TO_PT;
      const rightMarginPt = cfg.page.margins.right_mm * MM_TO_PT;
      const bottomMarginPt = cfg.page.margins.bottom_mm * MM_TO_PT;
      const pages = mergedDoc.getPages();
      for (let i = 1; i < pages.length; i++) { // skip the cover (index 0)
        const text = cfg.footer.page_number_format
          .replace("{page}", String(i))
          .replace("{total}", String(totalNumberedPages));
        const textWidth = numberFont.widthOfTextAtSize(text, 8);
        pages[i].drawText(text, {
          x: pageWidthPt - rightMarginPt - textWidth,
          y: bottomMarginPt - 10,
          size: 8,
          font: numberFont,
          color: rgb(0, 0, 0),
        });
      }
    }

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

if (require.main === module) {
  main().catch((err) => {
    console.error(`render.js failed: ${err.message}`);
    process.exit(1);
  });
}

// Exported so render_docx.js (Process 3) can share the exact same
// registry/config loading instead of a second, drifting copy -- these are
// all pure/stateless, so requiring this file for them has no side effects
// (main() only runs when this file is executed directly, per the guard
// above).
module.exports = {
  PROJECT_URL, DEFAULT_CONFIG, deepMerge, loadJson, loadRenderConfig,
  loadRegistry, loadManifestOrder, loadStatus, resolveSvgImagePaths,
  fontFamilyFor, normalizeForMatch,
};
