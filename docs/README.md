# docs/ — GitHub Pages upload/status site (Component 6)

Static site (no backend, no build step) implementing the Build Spec's
"GitHub Pages upload/status site" — the last of the seven components, built
now that the underlying CLI/Actions pipeline (components 1–5, Process 1B)
works end-to-end.

## Pages

- **`upload.html`** — the single entry point for onboarding a new asset or
  adding a locale/version to an existing one (FR1.1–FR1.5). Fires
  `bootstrap-asset.yml` via `repository_dispatch`.
- **`status.html`** — read-only dashboard over every asset/locale's
  `status.json`, live from the repo (NFR6).
- **`index.html`** — landing page linking the two.

## Auth: a pasted token, not "Sign in with GitHub"

The Build Spec calls for "GitHub OAuth device flow or a GitHub App, since
this is a static Pages site with no backend." In practice, device flow's
token-exchange endpoint (`github.com/login/oauth/access_token`) doesn't
send CORS headers, so a purely static page cannot complete that exchange
itself — every real implementation needs at least a minimal serverless
proxy for that one step, which is itself a (small) backend.

Given the explicit "no backend" constraint, this implementation instead
asks the user to paste a fine-grained PAT scoped to `translations` and
`translations-templates` (Contents: read/write). The token lives only in
`sessionStorage` (cleared when the tab closes) and is sent only to
`api.github.com`, which does support CORS for token-authenticated requests.
This is a real, load-bearing deviation from the spec's literal wording, not
an oversight — revisit if/when a GitHub App + a small auth proxy becomes
worth standing up.

## CAPTCHA

`js/captcha.js` gates `upload.html`'s submit action behind a simple
addition problem, regenerated on a wrong answer. Not meant as real
bot-proofing — a valid token already restricts submission to people with
write access to a private repo — it's a lightweight "confirm you mean to
trigger a commit + a workflow run" gate, deliberately simple to start.

## The two-step submit flow

`bootstrap-asset.yml` expects `uploaded_path` to point at a file already in
the repo (a `repository_dispatch` payload can't carry raw file bytes at any
useful size). So submitting a **new asset** is two API calls, in order:

1. `PUT /repos/.../contents/_incoming/<timestamp>-<filename>` — commits the
   raw upload directly to the default branch's `_incoming/` folder. This is
   the one place this pipeline commits without a PR, and it's intentional:
   it's a staging area, not a content change — the actual `registry.yaml`/
   folder-tree change still only ever happens via `bootstrap_asset.py`'s own
   PR, per the Build Spec's "the repo tree only ever grows through this
   path" invariant.
2. `POST /repos/.../dispatches` with `event_type: bootstrap-asset` and the
   form fields as `client_payload`, pointing `uploaded_path` at what was
   just committed.

Adding a locale to an **existing** asset skips step 1 entirely (no new file
— `payload.asset` is set instead, matching `bootstrap_asset.py`'s existing
`--asset` + no `--uploaded-path` path).

The asset id shown while picking a file is a preview only —
`js/upload.js`'s `deriveAssetIdPreview()` mirrors `tooling/asset_naming.py`
exactly (verified against the same test filenames both were tuned on) — but
the payload always leaves `asset` unset for a new upload, so
`bootstrap_asset.py` derives the real, authoritative id server-side. Never
trust the browser's copy as the source of truth.

## Locale catalog and the override-readiness warning

`js/locales.js` hardcodes the 22 locales enumerated in the Build Spec's own
`translations-templates` layout (the PRD's prose says "19" in three places —
a real inconsistency in the source documents; the actual enumerated list is
used here since it's the concrete data, per the PRD's own "Locale catalog
closure" open question). Each locale's `needsOverride` flag is the Build
Spec's own script-category judgment (Western European Latin and Greek: no
override needed; everything else: yes) — `js/upload.js` cross-references it
live against `translations-templates`' actual directory tree
(`fetchTemplateLocales()`) so the warning reflects real current coverage,
not just the static category.

## What's tested vs. not

Verified against the real (private) repos, using a temporary local test
harness (not committed) standing in for a user-pasted token:

- Token verification, `registry.yaml` fetch + YAML parse, and
  `translations-templates` locale-coverage lookup — all real API calls,
  real responses.
- The full locale checklist + override-warning render pipeline: all 22
  locales render, and exactly the 16 real script categories without a
  ported override yet are flagged (the 6 low-risk Western-European/Greek
  locales correctly aren't) — matches `translations-templates`' actual
  current state (default/ configs only, `migrate_archive.py` hasn't run).
- `deriveAssetIdPreview()` against `asset_naming.py` line-for-line, same
  test filenames.

**Not yet tested**: the two mutating calls (`putFile`, the
`repository_dispatch` trigger) — these have real side effects (a commit, a
workflow run) and weren't exercised against the live repo without asking
first. Recommend one real end-to-end submission (a throwaway test asset,
cleaned up after) before treating this as production-ready.
