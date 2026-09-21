# translations

The OWASP GenAI Security Project's self-service translation and publishing
pipeline. Replaces the archived, single-asset, closed-source-dependent
process from `www-project-top-10-for-large-language-model-applications`.

Full requirements and design: **`tooling/docs/`** — `REQUIREMENTS.md`
(PRD reconciliation, what's done/partial/not done), `DESIGN.md` (current
technical design, including where the implementation extended the original
Build Spec), `WORKFLOW.md` (the actual end-to-end operational walkthrough).
This file is the front door, not the manual.

**Visibility: public.** `translations-templates` (the render templates repo)
is private permanently, by design — it's the org's branded layout/asset
repo, not translated content.

## Two independently-triggered processes

This pipeline is deliberately split into two processes that don't run back
to back — see `tooling/docs/WORKFLOW.md` for the full walkthrough of both:

- **Process 1 — Draft, Review & Finalize**: triggered by an asset/locale
  upload. Runs `bootstrap_asset.py`, then `translate-draft.yml`, then loops
  through ordinary PR review until every section in a locale is `reviewed`.
  Ends there — nothing downstream fires automatically.
- **Process 2 — Assemble & Publish**: triggered separately, gated by a
  three-way human sign-off (`publish.yml`), never by Process 1 finishing.
  Renders the final PDF from `translations-templates` via `render.sh`. A
  second, CAPTCHA+TOTP-gated testing path (`publish-direct.yml`, fired from
  `docs/publish.html`) bypasses that sign-off for pipeline validation only —
  see `tooling/docs/WORKFLOW.md` for exactly what it does and doesn't
  guarantee.

Both processes are built and merged. The GitHub Pages upload/status/publish
site (component 6) is live at `docs/` — see `docs/README.md`.

## Layout

```
registry.yaml              # every onboarded asset's entry — written only by bootstrap_asset.py
tooling/
  docs/                      # REQUIREMENTS.md, DESIGN.md, WORKFLOW.md — start here
  registry_schema.py        # registry.yaml's schema + validation
  translation-config.yaml   # names the translation LLM (never hardcoded elsewhere)
  translation_config.py     # resolves it at runtime
  bootstrap_asset.py         # component 1 — onboard an asset/locale
  asset_naming.py             # derives a stable asset id from an uploaded filename
  docx_split.py              # splits a heading_1 .docx into English sections + figures
  pdf_split.py                # splits a pdf_heading PDF into English sections + figures (font-size heuristic)
  image_svg.py                 # Tier 1: OCR + blank + SVG text overlay for images with embedded text
  svg_localize.py               # translates a figure's SVG <text> nodes per locale
  llm_client.py               # provider-agnostic translation call
  text_quality.py              # detects garbled extraction artifacts before they reach translation
  translation_log.py            # per-section start/finish/validation audit log (translation_log.jsonl)
  translate_section.py        # component 2 — drafts sections for one locale
  status_schema.py            # status.json schema + read/write helpers
  review_transition.py        # Process 1B — the only writer of in_review/reviewed
  render_config_schema.py     # translations-templates' render_config.json schema + merge logic
  locale_script_categories.py # which locales need a render_config.json override before publish
  check_render_override.py    # Process 2, FR5 — override-readiness check
  check_signoff.py            # Process 2, FR4.2 — three-way sign-off checklist check
  verify_pdf.py                # re-verifies a released PDF's embedded authenticity checksum
  render.sh                    # component 5 — the open-source generator (wraps render/render.js)
  render/render.js               # the actual Puppeteer + markdown-it + pdf-lib renderer
  README.md                   # full schema docs + how to run this locally
docs/                        # component 6 — GitHub Pages upload/status/publish site
.github/workflows/
  bootstrap-asset.yml         # wraps bootstrap_asset.py, opens the onboarding PR
  translate-draft.yml         # wraps translate_section.py, opens the draft PR
  review-transitions.yml      # flips status.json on PR ready-for-review / merge
  check-freshness.yml         # nightly staleness check + opens the ready-to-publish issue
  publish.yml                  # component 3 — the real, sign-off-gated publish path
  publish-direct.yml           # testing-only publish path, CAPTCHA+TOTP gated, no sign-off
CODEOWNERS                    # interim — see tooling/README.md's Outstanding decisions
```

Per-asset content directories (e.g. `owasp-top-10-.../`) don't exist until
that asset is onboarded via `bootstrap_asset.py`, never created by hand.

## Status

See `tooling/docs/REQUIREMENTS.md` for the full point-by-point status against
the PRD. Headline gaps:

- `migrate_archive.py` (component 7) doesn't exist yet — no archived-repo
  locale has been migrated into this structure.
- `TEMPLATES_DEPLOY_KEY` isn't set — `publish.yml`/`publish-direct.yml`
  can't check out `translations-templates` in a real GitHub Actions run yet.
- Real named CODEOWNERS (currently a placeholder).
- Only Latin-script locales (`de-DE`, `fr-FR`) have been exercised end to
  end; the RTL/CJK/Cyrillic/complex-shaping render paths exist in the schema
  but haven't been validated against real font assets yet.

## Related repo

`translations-templates` (private, admin-group-only) holds the shared
render templates — three shared, generically-named templates
(`blue-template`/`green-template`/`yellow-template`), a shared
`assets/images/` (cover art, sponsors figure), and per-locale
`render_config.json` overrides.
