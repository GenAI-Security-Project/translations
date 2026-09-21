# Requirements: current status against the PRD

Reconciles this pipeline's actual implementation against the PRD
("PRD: OWASP GenAI Translations Pipeline", `~/translatePRD.docx` at the time
this was written). Each requirement's status is Done / Partial / Not done /
Superseded, with a one-line pointer to what implements it (or why it hasn't
been built). See `DESIGN.md` for the technical detail behind each pointer.

## Functional requirements

### FR1 — Onboarding (asset/locale intake)

| Req | Status | Notes |
|---|---|---|
| FR1.1 — GitHub Pages form, single entry point | Done | `docs/upload.html`, full locale multi-select via `docs/js/locales.js` |
| FR1.2 — Submitting triggers `bootstrap_asset.py`, scoped to selected locales | Done | Via `repository_dispatch` → `bootstrap-asset.yml` |
| FR1.3 — Re-submitting at a new version = new translation cycle | Done | `bootstrap_asset.py`'s existing-asset path |
| FR1.4 — Add-locale-later without a new version | Done | Same form, existing-asset mode |
| FR1.5 — Override-readiness heads-up at submit time, blocks only that locale later | Done | `js/upload.js`'s live `translations-templates` lookup at submit time; `check_render_override.py` is what actually blocks at publish time, per-locale |

### FR2 — Draft translation (Process 1, part A)

| Req | Status | Notes |
|---|---|---|
| FR2.1 — Split + machine-translate every required locale | Done | `docx_split.py`/`pdf_split.py` + `translate_section.py` |
| FR2.2 — LLM read from `translation-config.yaml` at runtime, never hardcoded | Done | `translation_config.py` |
| FR2.3 — `status.json` records status + `translator` (provider:model) | Done | `status_schema.py` |

### FR3 — Human review (Process 1, part B)

| Req | Status | Notes |
|---|---|---|
| FR3.1 — Review through normal PR review | Done | No custom review UI built or needed |
| FR3.2 — `reviewed` only via explicit human action | Done | `review_transition.py`, the only writer |
| FR3.3 — Process 1 ends at all-reviewed, no auto-continuation | Done | Confirmed by design — `check-freshness.yml` (Process 2) is a separate, later-triggered workflow |

### FR4 — Publish trigger & sign-off (Process 2, part A)

| Req | Status | Notes |
|---|---|---|
| FR4.1 — Separate explicit trigger, never automatic from Process 1 | Done | `check-freshness.yml` opens the issue; a human still has to sign off before `publish.yml` acts |
| FR4.2 — Three-way sign-off required | Done | `check_signoff.py`'s checklist-structure check |

**Addition beyond FR4:** `publish-direct.yml` + `publish.html`, a
CAPTCHA+TOTP-gated path that **bypasses** FR4.2 entirely — see `WORKFLOW.md`
for the exact scope. This exists for pipeline validation only and is a
deliberate, documented exception to FR4, not a replacement for it.

### FR5 — Override-readiness check (Process 2, part B)

| Req | Status | Notes |
|---|---|---|
| FR5.1 — Verify required script override present before rendering | Done | `check_render_override.py` + `locale_script_categories.py` |
| FR5.2 — Missing override = hard fail, never silent fallback | Done | Non-zero exit, `::error::` to the admin group |

### FR6 — Assemble & publish (Process 2, part C)

| Req | Status | Notes |
|---|---|---|
| FR6.1 — Assemble, render via assigned template, release | Done | `render.sh` → `render.js` → GitHub Release |

### FR7 — Shared, generalized render templates

| Req | Status | Notes |
|---|---|---|
| FR7.1 — Generic naming (blue/green/yellow), shared not per-asset | Done | `translations-templates/{blue,green,yellow}-template/` |
| FR7.2 — blue=ranked-risk-list, green=narrative, yellow=checklist | Done | The one real asset (`owasp-top-10-...`, a ranked top-10) uses `blue-template` per this rule |
| FR7.3 — Locale overrides layered on shared template, never forked | Done | `render_config_schema.py`'s deep-merge (`default/` + `<locale>/`) |

### FR8 — Locale & script coverage

| Req | Status | Notes |
|---|---|---|
| FR8.1 — All enumerated locales render correctly per script category | **Partial** | Only `de-DE` and `fr-FR` have real translated content and have been rendered/verified. `locale_script_categories.py` implements the category enumeration and gate; the render-correctness verification described in the Build Spec's 8 validation groups (RTL, CJK, Cyrillic, complex-shaping, etc.) has not been run — no font assets or locale overrides exist yet for those categories in `translations-templates`. |
| FR8.2 — New locale in an existing category = config only, no new code | Done by construction | `render_config_schema.py`'s override mechanism; not yet exercised for a category beyond Latin |

### FR9 — Migration

| Req | Status | Notes |
|---|---|---|
| FR9.1 — Migrate archived-repo translations via `migrate_archive.py` | **Not done** | The script does not exist. No archived-repo locale has been carried over — the one real asset was onboarded fresh through the normal upload path, not migration. This is the single largest gap against the PRD's "no lost work" (NFR9) goal, since it means no archived translation has actually been preserved into the new structure yet. |

### FR10 — Templates repo access control

| Req | Status | Notes |
|---|---|---|
| FR10.1 — Separate, private `translations-templates` repo | Done | Exists, referenced by SSH deploy key (see NFR4/gap below) |

## Non-functional requirements

| # | Requirement | Status | Notes |
|---|---|---|---|
| NFR1 | Registry-driven, no per-asset code | Done | `registry.yaml` + `registry_schema.py`; adding an asset is a PR to this file, not new code |
| NFR2 | Configurable translation engine | Done | `translation-config.yaml` |
| NFR3 | Open-source rendering, no closed-source dependency | Done | `render.js` (Puppeteer + markdown-it + pdf-lib + pdfjs-dist), fully owned |
| NFR4 | Tamper resistance — templates repo writable only by publish + admins | **Partial** | The repo itself exists and is private; the deploy key that would actually enforce "writable only by the publishing Action" (`TEMPLATES_DEPLOY_KEY`) is not yet configured, so `publish.yml`/`publish-direct.yml` cannot check it out in a real Actions run today |
| NFR5 | No silent mis-rendering | Done | `check_render_override.py`'s hard fail |
| NFR6 | Auditability (status, model, source commit) | Done | `status.json` + `translation_log.jsonl` + `docs/status.html` |
| NFR7 | No automatic publishing | Done | Enforced structurally by the two-process split; `publish-direct.yml` is a documented, gated exception used for pipeline testing only, not a violation of intent |
| NFR8 | Correct rendering across scripts | **Partial** | See FR8.1 — the mechanism exists (`render_config_schema.py`'s `direction`/`line_breaking`/`numerals` fields, `locale_script_categories.py`'s gate) but has only been exercised for Latin-script locales so far |
| NFR9 | No lost work (migration preserves everything) | **Not applicable yet** | No migration has run — see FR9.1. Nothing has been *lost* (nothing has been migrated), but the requirement's actual goal (archived work carried forward) is unmet |
| NFR10 | Self-service intake, no maintainer request needed | Done | `docs/upload.html`'s full end-to-end flow, gated only by CAPTCHA + TOTP, not a human approval step |

## Additions beyond the original PRD

Implemented but not called for in the PRD — documented here so they're not
mistaken for scope creep against a requirement, since none of them replace
or weaken anything the PRD asked for:

- **TOTP authenticator gate** on `bootstrap-asset.yml` and `publish-direct.yml`'s
  `repository_dispatch` paths (`UPLOAD_TOTP_SECRET`, shared between both).
  The PRD assumed GitHub OAuth device flow or a GitHub App for the Pages
  form's auth; in practice, device-flow token exchange needs a backend a
  static Pages site doesn't have, so the actual auth model is a pasted PAT
  (for reads/writes the PAT itself scopes) plus a server-side-only TOTP
  check specifically on the two Actions that fire off the public,
  unauthenticated `repository_dispatch` surface.
- **`publish-direct.yml` / `publish.html`** — see FR4's note above.
- **Two-pass TOC page numbers** — the PRD/Build Spec only mentions "TOC
  labels" as a render_config field, not page numbers at all.
- **Cover-art rebrand** (real OWASP cover-band artwork, dragonfly-in-circle
  motif, navy fill) and the CSS-crop technique that avoids modifying the
  shared source image — not specified in the PRD, done to match the org's
  real visual identity once real brand assets became available.
- **Sponsors image decoupling** (`SponsorsConfig`) — not in the original
  schema description; added so a sponsor-roster change is a one-file swap
  instead of an edit across every asset/locale.
- **Dead source-TOC exclusion** — a data-quality fix (see `DESIGN.md`)
  triggered by building the TOC page-number feature, not a requirement on
  its own, but worth tracking here since it changes what content actually
  ships in the real asset's PDF.
