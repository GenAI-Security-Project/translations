# Design: OWASP GenAI Translations Pipeline

Current-state technical design. The original design brief is the PRD's
"Build Spec" tab (`~/translateBuildSpec.docx` at the time this was written,
condensed into `tooling/README.md`'s earlier revisions) — that document
describes the *plan*; this one describes *what was actually built*, including
where the implementation extended or diverged from that plan. See
`REQUIREMENTS.md` for the point-by-point reconciliation against the PRD's
FR/NFR list, and `WORKFLOW.md` for the operational walkthrough.

## Two independently-triggered processes

Unchanged from the original design: this pipeline is deliberately split into
two processes that never chain automatically into each other (NFR7).

- **Process 1 — Draft, Review & Finalize.** Triggered by an asset/locale
  upload. Runs `bootstrap_asset.py`, then `translate-draft.yml`, then loops
  through ordinary PR review until every section in a locale is `reviewed`.
  Ends there.
- **Process 2 — Assemble & Publish.** Triggered separately — `check-freshness.yml`
  notices an all-`reviewed` locale and opens a "ready to publish" issue;
  `publish.yml` only runs once three-way sign-off is recorded on that issue.
  Renders the final PDF from `translations-templates`. No translation happens
  here.

Both processes are now fully built and merged to `main`. The stale framing in
earlier revisions of the root `README.md` ("Process 2 — not built yet") no
longer applies.

## Components

| # | Component | Implements | Status |
|---|---|---|---|
| 1 | Onboarding | `bootstrap_asset.py`, `asset_naming.py`, `bootstrap-asset.yml` | Done |
| 2 | Draft translation | `translation-config.yaml`, `translation_config.py`, `llm_client.py`, `docx_split.py`, `pdf_split.py`, `image_svg.py`, `svg_localize.py`, `text_quality.py`, `translation_log.py`, `translate_section.py`, `translate-draft.yml` | Done |
| 1B | Human review | `review_transition.py`, `review-transitions.yml` | Done |
| 3 | Assemble & publish | `render.sh`, `tooling/render/render.js`, `publish.yml` | Done |
| 4 | Freshness / override-readiness | `check-freshness.yml`, `check_render_override.py`, `check_signoff.py`, `locale_script_categories.py` | Done |
| 5 | Open-source generator | `tooling/render/render.js` (Puppeteer + markdown-it + pdf-lib + pdfjs-dist) | Done, see "The renderer" below |
| 6 | GitHub Pages upload/status/publish site | `docs/*.html`, `docs/js/*.js` | Done — see `docs/README.md` for the full writeup, not duplicated here |
| 7 | Migration | `migrate_archive.py` | **Not built.** No asset has been migrated from the archived repo yet; the one real asset onboarded so far (`owasp-top-10-for-agentic-applications-2026-12-6-1`) came in through the normal upload path, not migration. |

Two components not in the original seven, added during this build-out:

| Addition | Implements | Why |
|---|---|---|
| TOTP gate on public-triggered Actions | `UPLOAD_TOTP_SECRET` repo secret, checked in `bootstrap-asset.yml` and `publish-direct.yml` | The PRD assumed a GitHub App/OAuth-gated form; the actual site is a public static Pages site with no backend, so anyone can POST a `repository_dispatch`. A server-side-only shared secret (never shipped to the browser) closes that gap without standing up an auth proxy. |
| `publish-direct.yml` + `publish.html` | Testing-only publish path, CAPTCHA + TOTP gated, bypasses the three-way sign-off | Exists so Process 2's rendering pipeline can be validated end-to-end against real content before a live sign-off process (named roles, an actual "ready to publish" issue habit) exists. **Not a substitute for `publish.yml`** — see `WORKFLOW.md` for exactly what it does and doesn't guarantee. |

## The renderer (`tooling/render/render.js`)

Not documented anywhere before this file — the PRD/Build Spec only says
"md-to-pdf/Puppeteer... implementing the full `render_config.json` schema."
This section is that gap filled in.

### Pipeline shape

1. Load `registry.yaml` (which template + owners) and `render_config_schema.py`'s
   merged config (`<template>/default/render_config.json` deep-merged with
   `<template>/<locale>/render_config.json` if present).
2. Walk the asset's manifest order (`_source/_manifest.json`), assembling each
   section's `.md` (via `markdown-it`) or `.svg` figure into one HTML document,
   with two exclusions applied at this stage (see "Dead source-TOC exclusion"
   below).
3. Compute a SHA-256 checksum over the raw assembled content (not the rendered
   HTML/PDF) — embedded both as a faint per-page on-page stamp and as real PDF
   metadata (`Keywords`), independently reverifiable via `verify_pdf.py`.
4. Render the cover as its own single-page PDF (no footer — a cover isn't
   "page 1" as a reader counts pages) and the rest of the document as a
   separate PDF (footer on, its own page-number counter starting at 1), then
   merge them with `pdf-lib`.
5. Write the merged PDF to `<asset>/<locale>/release/`.

### Two-pass render: TOC page numbers

The table of contents lists every `h1`/`h2` heading with a real page number,
not just a title (titles-only was the honest v1, before this build-out).
Getting a real number requires knowing, ahead of generating the TOC, which
page each heading will land on — which in turn depends on the TOC's own
length, which depends on... itself. Solved with two renders:

1. **Front-matter measurement.** Render the legal notice + TOC alone (titles
   only, no numbers yet) to count exactly how many pages that front matter
   takes.
2. **Pass 1 (throwaway).** Render the full document (front matter + all
   content) with the same titles-only TOC. Extract per-page text via
   `pdfjs-dist` (dynamically imported — it's ESM-only from v5, this file is
   CommonJS). Starting the search pointer *after* the front-matter page count
   from step 1 (otherwise every heading "matches" on the TOC's own page,
   which lists every title verbatim with no number yet), walk each heading
   in document order and record the first page its title text appears on.
   The pointer only ever advances forward, so a heading whose exact title
   text is repeated (or referenced elsewhere) can't steal an earlier
   heading's page number.
3. **Pass 2 (final).** Re-render the TOC with those numbers filled in
   (dot-leader layout), and render the full document again — this is the
   PDF that actually ships.

Both TOC renders share identical markup (title span, dot-leader span, page
number span — empty in pass 1, filled in pass 2), so filling in a short
number never reflows anything pass 1 measured against.

**Known limitation:** the forward-pointer match is a plain substring match
on normalized (whitespace-collapsed) heading text, not a structural anchor.
A sub-heading whose exact title happens to repeat verbatim in a way that
shifts which occurrence gets matched first can end up with no page number
(rendered blank rather than a guessed/wrong one — consistent with this
project's "honest gap over fabricated data" stance elsewhere, e.g.
`translation_log.py`'s validation). Observed in practice on a small number
of level-2 sub-headings (e.g. a repeated "Common examples of the
vulnerability"-style sub-heading) in the one real asset rendered so far;
all level-1 headings resolved correctly.

### Dead source-TOC exclusion

Verifying the two-pass TOC feature against the real asset surfaced a
pre-existing content bug, unrelated to page numbers per se: the source
PDF's own printed table of contents had been captured **twice** at
split time —

1. As an ordinary text section (manifest name `Table_of_Content`, stable
   across locales since it's derived from the section's *English* heading
   at split time) — containing the source document's own stale heading list
   *with the source document's own now-wrong page numbers baked in as plain
   text* (retranslation and reflow make the original pagination meaningless).
2. As a **separate scanned figure** with OCR text overlaid (`image_svg.py`'s
   Tier 1 pipeline) — the same page, captured as an image because the source
   PDF apparently also rasterized it, landing under a `..._Figure_N` name
   derived from its position, not its own content, so it couldn't be caught
   by name matching.

Both are dead weight now that `render.js` builds an accurate TOC itself, and
both were silently shipping in the actual published PDF as body content
between the real intro and the real first section — a defect in the same
family as the earlier page-number/footer-URL leaks fixed for this asset
(see `text_quality.py`'s `is_page_number_artifact`/`is_footer_url_artifact`),
just never caught because nothing was specifically looking for a duplicated
front-matter section. Both are now excluded, unconditionally, at render time:

- The text section, by its stable manifest name
  (`/^table_of_contents?$/i`) — general and safe for any future asset,
  since a source PDF's own printed TOC is never legitimate translatable body
  content once this renderer generates its own.
- The OCR'd figure, by comparing its first `<text>` element against that
  same locale's `Table_of_Content.md` heading (locale-agnostic — matches the
  German "Inhaltsverzeichnis" and French "Table des matières" variants
  actually observed, not a hardcoded English phrase).

### Cover art

The cover uses the real OWASP cover-band artwork extracted from the org's
`OWASP-InitiativeOutputsDoc-Template` docx — used **as-is, unmodified**
(dragonfly-in-circle motif included; an earlier iteration pre-cropped the
file to exclude the mark and to isolate just the band, both since reverted
per explicit instruction). The band-only look is achieved without touching
the source file: `object-fit: cover; object-position: top` on the `<img>`
crops it to just its top ~20% (the navy gradient band) at render time; the
rest of the cover page is filled by `cover.background_color` (the real site
navy, `#233B4F`) rather than the image's own baked-in white lower ~80%.
`COVER_TOP_BAND_RATIO` in `render.js` documents the exact measured ratio.

The same shared asset (`assets/images/cover-band.png` in
`translations-templates`) is used by all three templates — swapping the
band means replacing this one file, not three.

### Sponsors image substitution

See `render_config_schema.py`'s `SponsorsConfig` docstring for the full
rationale. In short: a sponsors/supporters figure changes on the org's own
sponsor-roster schedule, not any asset's translation cycle, so
`cover.sponsors.image_path` (when set) substitutes one shared image for
whichever figure's *manifest name* matches `match_keywords`
(`sponsor`/`supporter`/`acknowledgement` by default) — matched only against
actual figure files (`fs.existsSync(svgPath)`), never a same-named `.md`
text section, since an "Acknowledgements" prose section and an
"Acknowledgements_Figure_N" sponsors graphic can share that keyword and must
not be conflated.

### Watermark

A single centered diagonal "DRAFT — NOT FOR RELEASE" stamp on every page of
a non-`--final` render (`render.sh`'s `--final` flag, set only by
`publish.yml`'s approved run and `publish-direct.yml` when its watermark
checkbox is unchecked). **`watermark.repeat` (tiled mode) is defined in the
schema but not implemented** — `render.js` always renders the single-stamp
variant regardless of that config value. Revisit if a single stamp proves
easy to crop out of a screenshot/photo in practice.

### Footer and page numbers

`show_page_numbers`/`page_number_format`/`show_url`/`url_href` (per-template
config) render into Puppeteer's `footerTemplate`. The cover is excluded from
numbering — Puppeteer has no per-page footer toggle, so the cover renders as
its own separate, footer-less single-page PDF and everything else renders
with the footer on, its own `pageNumber` counter starting at 1; the two PDFs
are merged after. `url_href` (when set) renders as a real clickable PDF link
annotation, confirmed via PyMuPDF inspection — not just styled text.

### Authenticity tracking

A SHA-256 over the assembled raw content (translated text + figure SVGs,
excluding the sponsors substitution and the dead-TOC exclusions above —
those aren't this asset's own content) is embedded two ways: a faint
per-page on-page stamp (`opacity: 0.12`, low enough to be non-intrusive,
high enough to be legible under zoom) and real PDF metadata (`Keywords`,
`Subject`, `Producer`, `Creator` via `pdf-lib`). `verify_pdf.py` reads the
metadata back and, given `--asset --locale --root --templates-root`,
recomputes the checksum from the current on-disk section files to confirm
the published PDF hasn't drifted since publication — replicating the same
sponsors-exclusion logic `render.js` applies, since a naive recompute would
always mismatch for a template with `sponsors.image_path` configured.

## The GitHub Pages site (component 6)

Fully covered in `docs/README.md` — not duplicated here. Summary: `index.html`
(landing), `upload.html` (onboarding, CAPTCHA + TOTP gated, PAT-based auth
since GitHub OAuth device flow needs a backend a static Pages site doesn't
have), `status.html` (read-only dashboard, no auth needed — public repo),
`publish.html` (the testing-only direct-publish path, same CAPTCHA + TOTP
gate).

## Known gaps

- **`TEMPLATES_DEPLOY_KEY` is not set** on the `translations` repo. Both
  `publish.yml` and `publish-direct.yml` check out `translations-templates`
  via `ssh-key: ${{ secrets.TEMPLATES_DEPLOY_KEY }}` — until this secret
  exists, neither workflow can actually run to completion in real GitHub
  Actions (they've only been validated by running `render.sh` directly,
  outside Actions, against a local `translations-templates` checkout).
- **`migrate_archive.py` (component 7) does not exist.** No archived-repo
  locale has been migrated; every locale so far came in through the normal
  upload path.
- **CODEOWNERS is a placeholder** (`tooling/README.md`'s "Outstanding
  decisions" — the two named initiative leads were never assigned).
- **`fr-FR/Acknowledgements_Figure_3.svg`** has known corrupted/OCR-garbled
  `<text>` elements (7 of an originally-found 8) not yet fixed — needs real
  translation API access to properly re-transcribe, not something to
  hand-patch.
- **TOC page numbers can be blank** for some sub-headings — see "Two-pass
  render" above.
- **Watermark tiling is not implemented** — see "Watermark" above.
