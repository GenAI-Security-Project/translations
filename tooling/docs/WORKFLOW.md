# Workflow: end-to-end operational walkthrough

How an asset actually moves through this pipeline today, from upload to
release. See `DESIGN.md` for the technical detail behind each step and
`REQUIREMENTS.md` for which PRD requirement each step satisfies.

## Process 1 — Draft, Review & Finalize

```
docs/upload.html
      │  (CAPTCHA + PAT auth; TOTP code entered but not client-verifiable)
      ▼
repository_dispatch (bootstrap-asset)
      │
      ▼
bootstrap-asset.yml
      │  1. Verify TOTP code server-side against UPLOAD_TOTP_SECRET
      │     (only when triggered via repository_dispatch — workflow_dispatch,
      │     which already requires repo write access, is exempt)
      │  2. Run bootstrap_asset.py — validates the asset name/version is new
      │     (or a real new version of an existing asset), opens a PR adding
      │     the registry.yaml entry + scaffolded folder tree
      ▼
[human merges the onboarding PR]
      ▼
translate-draft.yml  (fired once per requested locale)
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
status.json: every section "reviewed"  →  Process 1 ends here, nothing
                                           downstream fires automatically
```

`docs/status.html` is a live, read-only view over every asset/locale's
`status.json` at any point in this loop — no auth needed, since `translations`
itself is public.

## Process 2 — Assemble & Publish

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

### The testing path: `publish-direct.yml`, CAPTCHA + TOTP, no sign-off

```
docs/publish.html
      │  TESTING_MODE=true lists every asset/locale regardless of review
      │  completeness (each row shows its reviewed/total count). Checkboxes
      │  select which (asset, locale) pairs to publish; "Include watermark"
      │  (checked by default) maps to render.sh's --final flag being *absent*.
      ▼
repository_dispatch (publish-direct), one per checked row
      ▼
publish-direct.yml
      │  1. Verify TOTP code server-side against UPLOAD_TOTP_SECRET (same
      │     secret and mechanism as bootstrap-asset.yml)
      │  2. check_render_override.py — same FR5 check as the real path
      │  3. render.sh [--final if watermark unchecked]
      │  4. Commit to release/, cut a GitHub Release
```

**What this path guarantees and doesn't:**

- It **does** still enforce FR5 (override-readiness) — that check isn't
  bypassed, only the sign-off is.
- It **does** still enforce `render.sh --final`'s own hard requirement that
  every section be `reviewed` before a non-watermarked PDF is produced,
  regardless of what `TESTING_MODE` chose to list as selectable.
- It **does not** require any human sign-off beyond whoever holds a valid
  TOTP code and can solve the CAPTCHA — there is no localization-lead /
  technical-reviewer / ops-executive gate on this path at all.
- **This is intentional and documented**, not a bug: it exists specifically
  so the rendering pipeline (`render.js`, `render.sh`) can be exercised
  end-to-end against real content before a live sign-off process (named
  people, an actual habit of using the issue checklist) exists. Revisit —
  fold into `publish.yml` behind a feature flag, or retire outright — once
  real sign-off practice exists. Don't treat a `publish-direct.yml` release
  as equivalent in trust to a `publish.yml` release.

## Secrets and what they gate

| Secret | Repo | Checked by | Gates |
|---|---|---|---|
| `UPLOAD_TOTP_SECRET` | `translations` | `bootstrap-asset.yml`, `publish-direct.yml` | Both public-triggered `repository_dispatch` surfaces (onboarding, testing-publish) |
| `TEMPLATES_DEPLOY_KEY` | `translations` | `publish.yml`, `publish-direct.yml` | Checking out the private `translations-templates` repo — **not currently set** (see `DESIGN.md`'s "Known gaps"); neither publish workflow can complete in real GitHub Actions until it is |

Neither secret is ever sent to the browser — both checks happen entirely
inside the Action's own environment, which is why a TOTP code (not a
client-side passphrase comparison) is the actual protection, not just UX
friction.

## What a fresh clone needs to run this locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tooling/requirements.txt
export ANTHROPIC_API_KEY=sk-...     # for real translation; omit + pass --offline to skip

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
