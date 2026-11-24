# Workflow: end-to-end operational walkthrough

How an asset actually moves through this pipeline today, from upload to
release. See `DESIGN.md` for the technical detail behind each step and
`REQUIREMENTS.md` for which PRD requirement each step satisfies.

## The generate process (Process 1) — Draft, Review & Finalize

```
"Onboard a document" issue form (linked from docs/upload.html)
  — or "Add languages" (pre-filled from docs/status.html's picker)
      │  GitHub sign-in, file dragged into the form — no token
      ▼
onboard-from-issue.yml  (`onboarding` / `add-language` label applied)
      │  require-manager, then parse_onboarding_issue.py validates the form
      ▼
bootstrap-asset.yml  (as a reusable workflow; also workflow_dispatch
      │               for manual runs)
      │  1. require-manager: the triggering user must have Maintain/Admin
      │     here (translations-managers team or org owner), however it
      │     was started
      │  2. Download the issue attachment (if any) to the runner
      │  3. Run bootstrap_asset.py — validates the asset name/version is new
      │     (or a real new version of an existing asset), opens a PR adding
      │     the registry.yaml entry + scaffolded folder tree
      ▼
[a manager merges the onboarding PR — or, for "Add languages", the
 workflow merges its registry-only setup PR itself]
      ▼
start-translations.yml  (bootstrap PR merged, or called after add-language)
      │  works out the newly registered locales; one at a time:
      ▼
translate-draft.yml  (once per new locale; also Run workflow by hand)
      │  1. If a new .docx/.pdf was uploaded: split it into _source/ once
      │     (docx_split.py / pdf_split.py, by heading_1 style or detected
      │     PDF heading font sizes)
      │  2. For each section without a status.json entry yet: translate via
      │     the LLM named in translation-config.yaml, log the attempt
      │     (translation_log.jsonl), write a draft .md/.svg + status:"draft"
      ▼
[draft PR opened, labeled status:draft, locale owner requested as reviewer]
      ▼
ordinary PR review
      │  review_transition.py (via review-transitions.yml) is the only
      │  writer of draft→in_review (PR marked ready) and in_review→reviewed
      │  (PR merged) — always an explicit human action
      ▼
[repeat translate-draft.yml / review loop per section, per correction]
      ▼
status.json: every section "reviewed"  →  the generate process (Process 1)
                                           ends here, nothing downstream
                                           fires automatically
```

`docs/status.html` is a live, read-only view over every asset/locale's
`status.json` at any point in this loop — no auth needed, since `translations`
itself is public.

## The publish process (Process 2) — Assemble & Publish

Two separate paths exist. **They are not equivalent** — read both before
assuming either one is "the" publish flow.

### The real path: `publish.yml`, three-way sign-off

```
check-freshness.yml  (nightly, matrix over every asset x locale)
      │  1. Diff each reviewed section's source_commit against _source/
      │     HEAD; flip any mismatch to "stale"
      │  2. If a locale has zero draft/in_review/stale sections (all
      │     reviewed, total > 0) and no open ready-to-publish issue exists
      │     for it: open one, with the three-checkbox sign-off template
      ▼
[open issue: "Ready to publish: <asset> / <locale>"]
      │  - [ ] Localization lead
      │  - [ ] Technical/content reviewer
      │  - [ ] Project/ops executive
      ▼
[three humans check their box, in any order, over any timeframe]
      ▼
publish.yml  (fires on every edit to that issue)
      │  1. check_signoff.py — re-parses the checklist; exits 2 (not an
      │     error) if incomplete, 0 once all three are checked
      │  2. check_render_override.py — FR5: does this locale's script
      │     category have the render_config.json override it needs?
      │     Hard-fails (::error::, no fallback) if not.
      │  3. render.sh --final — the real, non-watermarked PDF
      │  4. Commit to release/, cut a GitHub Release, comment + close
      │     the issue
```

No step here can be skipped or reordered by a client-side action — the
whole gate lives server-side in the Action.

### The preview path: `publish-direct.yml` (watermarked, never published)

```
Actions → publish-direct → Run workflow  (GitHub sign-in, no token;
      │  inputs: asset, locale. Not offered on docs/publish.html.)
      ▼
publish-direct.yml
      │  1. require-manager (same check as every pipeline workflow)
      │  2. check_render_override.py — same FR5 check as the real path
      │  3. render.sh WITHOUT --final: watermarked DRAFT preview PDF
      │  4. Upload it as a workflow artifact (14 days) — nothing committed,
      │     no GitHub Release
```

It renders the current translation (every section, whatever its status)
with the DRAFT watermark, so the rendered layout can be checked before
sign-off. **It cannot publish**: since 2026-11-24 it has no unwatermarked
option, doesn't commit the PDF to `release/`, and doesn't create a
Release. Per the project's rule — **nothing is published without the
three-way sign-off** — the only publishing path is `publish.yml`.

## Process 4 — Assemble for Layout (designer handoff)

For when a person, not the renderer, does the final graphical layout.

```
[every section of <asset>/<locale>/status.json is "reviewed"]
      ▼
Actions → layout-handoff → Run workflow (asset, locale)
      │  workflow_dispatch, translations managers only (require-manager);
      │  the run records who did (GITHUB_ACTOR)
      ▼
layout-handoff.yml → tooling/render-layout-docx.sh
      │  1. Refuses unless every section is "reviewed" (no override)
      │  2. Assembles the same sections, in the same order, as the PDF
      │  3. Writes a plain .docx: Word built-in styles only (Title,
      │     Heading 1–6, Normal, List, Quote, Table Grid, Caption), a
      │     handoff sheet + review record + TOC field up front, a running
      │     header (title/locale/version), a diagonal "DRAFT – NOT FOR
      │     DISTRIBUTION" watermark and footer on every page, content sha256
      │  4. Exports figure sources to figures/ (self-contained SVG); dashed
      │     placeholders in the .docx mark where each figure / sponsor
      │     block belongs
      ▼
run artifact "layout-handoff-<asset>-<locale>" (.docx, figures/,
HANDOFF.md; kept 14 days) → downloaded by whoever ran it → sent to the
layout designer
```

No template assets are read, so the .docx is safe to hand outside the admin
group and the workflow runs without `TEMPLATES_DEPLOY_KEY`. The content
sha256 matches the one in the published PDF's footer for the same content.
Artifacts on a public repo are downloadable by any signed-in GitHub user
while retained — acceptable here because the text is already public in the
repo, but don't treat the artifact as private.

## Secrets and what they gate

| Secret | Repo | Checked by | Gates |
|---|---|---|---|
| `TEMPLATES_DEPLOY_KEY` | `translations` | `publish.yml`, `publish-direct.yml` | Checking out the private `translations-templates` repo — **not currently set** (see `DESIGN.md`'s "Known gaps"); neither publish workflow can complete in real GitHub Actions until it is |

No secret is ever sent to the browser. Who may run the pipeline is not a
secret at all: it's the `translations-managers` team (Maintain on this repo),
checked by `.github/actions/require-manager` at the start of
`bootstrap-asset.yml`, `translate-draft.yml`, `publish-direct.yml` and
`layout-handoff.yml`. The old `UPLOAD_TOTP_SECRET` repo secret is no longer
read by anything and can be deleted.

## What a fresh clone needs to run this locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tooling/requirements.txt
export GEMINI_API_KEY=...          # for real translation (Gemini, the default); omit + pass --offline to skip

python tooling/bootstrap_asset.py --asset my-asset --version 2026.1 \
  --locales es-ES --source-repo owner/repo --source-path _source/ \
  --split-by existing_files --template blue-template --owners you \
  --uploaded-path /path/to/sections

python tooling/translate_section.py --asset my-asset --locale es-ES

# Requires a sibling translations-templates checkout (or --templates-root):
export PUPPETEER_EXECUTABLE_PATH="/path/to/chrome"   # if the bundled Chrome isn't installed
bash tooling/render.sh --asset my-asset --locale es-ES
```

`render.sh` installs `tooling/render/`'s npm dependencies on first run.
`PUPPETEER_EXECUTABLE_PATH` is only needed when Puppeteer's own bundled
Chromium isn't available in the environment (e.g. a sandboxed dev machine
with a system Chrome instead).
