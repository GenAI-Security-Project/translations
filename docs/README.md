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
- **`publish.html`** — Process 2 (Assemble & Publish)'s direct/testing
  publish trigger. Lists every asset/locale (see "Publish page" below),
  fires `publish-direct.yml` via `repository_dispatch` once per checked row.
- **`index.html`** — landing page linking the rest.

## Publish page

A real publish normally requires a three-way sign-off on a "ready to
publish" issue (`check-freshness.yml` opens it, `publish.yml` enforces the
gate — see `tooling/check_signoff.py`). `publish.html` is a separate,
CAPTCHA + authenticator-gated direct path (`publish-direct.yml`) that
bypasses that sign-off gate, so the rendering pipeline can be exercised
against real content before a live sign-off process exists.

- **Listing**: a `TESTING_MODE` constant in `js/publish.js` (currently
  `true`) shows every asset/locale regardless of review completeness, each
  with a checkbox and its `reviewed/total` count. Flip it to `false` once
  real sign-off practice + fully-reviewed content exist, to only list a
  fully-reviewed locale.
- **Include watermark** (checked by default): controls `render.sh`'s
  `--final` flag per selected row — checked always renders a watermarked
  preview (allowed regardless of review status); unchecked requests a real
  final render, which `render.sh` itself still hard-refuses unless every
  section is reviewed, regardless of what `TESTING_MODE` lists as
  selectable.
- **Publish selected**: one `repository_dispatch` (`publish-direct`) per
  checked row, each carrying `{asset, locale, watermark, totp_code}`.
  `publish-direct.yml` verifies the code server-side against
  `UPLOAD_TOTP_SECRET` (same secret and mechanism as `bootstrap-asset.yml`'s
  public-form path) before rendering anything.

## Auth: a pasted token, not "Sign in with GitHub" — and only where a write needs it

The Build Spec calls for "GitHub OAuth device flow or a GitHub App, since
this is a static Pages site with no backend." In practice, device flow's
token-exchange endpoint (`github.com/login/oauth/access_token`) doesn't
send CORS headers, so a purely static page cannot complete that exchange
itself — every real implementation needs at least a minimal serverless
proxy for that one step, which is itself a (small) backend.

Given the explicit "no backend" constraint, `upload.html` asks the user to
paste a fine-grained PAT scoped to `translations` and
`translations-templates` (Contents: read/write) — needed there because it
reads the still-private `translations-templates` and performs the two
writes (`putFile`, `dispatchBootstrapAsset`). The token lives only in
`sessionStorage` (cleared when the tab closes) and is sent only to
`api.github.com`, which does support CORS for token-authenticated requests.

`index.html` and `status.html` don't ask for a token at all: `translations`
itself is public, so `fetchRegistry()`/`fetchStatusJson()` work as plain
unauthenticated reads (`ghFetch` only attaches `Authorization` when
`sessionStorage` actually has a token — see `github-api.js`). `verifyToken()`
now checks `translations-templates` specifically, since checking the public
`translations` repo would no longer prove anything about the pasted token
(a public repo answers any syntactically valid request, garbage token or
not — an actually invalid/expired one still 401s regardless of visibility).

This asymmetry (public reads, gated writes) is intentional, not an
oversight — revisit the pasted-token model if/when a GitHub App + a small
auth proxy becomes worth standing up.

## CAPTCHA + authenticator code

`js/captcha.js` gates `upload.html`'s submit action behind a simple
addition problem, regenerated on a wrong answer — a lightweight "confirm
you mean to trigger a commit + a workflow run" gate, not real bot-proofing.

On top of that, `bootstrap-asset.yml` requires a 6-digit TOTP authenticator
code (`client_payload.totp_code`, checked in the "Verify authenticator
code" step) whenever it's reached via `repository_dispatch` — the path the
public form uses now that the repo and Pages site are both public. This is
real protection, not just friction, because the shared secret
(`UPLOAD_TOTP_SECRET`, a repo secret) lives only in the Action's
environment and is never shipped to the browser — unlike a client-side
passphrase check would be, which anyone can read straight out of the
page's own JS. `workflow_dispatch` (manual runs) is exempt: triggering it
already requires write access to this repo, granted by GitHub itself.

The client only checks the code is 6 digits before submitting — it can't
verify the code itself without holding the secret, which would defeat the
point. A wrong/expired code still gets a `repository_dispatch` 204 back
(that call just queues the event) and fails visibly on the Actions tab
instead.

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

## Live status bars after submitting

Both `upload.html` (after `bootstrap-asset.yml` fires) and `publish.html`
(after each `publish-direct.yml` fire — one per checked asset/locale row)
show a live status bar tracking the actual Actions run, instead of just
pointing the user at the Actions tab: current step, a progress bar, and a
link to the run once it's found. `js/workflow-status.js` implements this;
`js/upload.js`/`js/publish.js` just create one `WorkflowStatusBar` per
dispatch and call `.track(workflowFile, excludeIds)`.

The one real wrinkle: `POST /dispatches` returns no run id (that's just how
`repository_dispatch` works), so a bar can't be told "watch run #12345" —
it has to find its own run by elimination. `excludeIds` is a snapshot of
that workflow's existing run ids, taken *immediately before* the dispatch
call; the bar then polls the run list until an id shows up that wasn't in
that snapshot, and attributes that one to itself. This is unambiguous for
`upload.html` (one dispatch per submit), but `publish.html` can fire several
dispatches back to back — there, each request's bar must finish attributing
its run (and add that id to the shared exclude set) *before* the next
request's dispatch fires, or two requests started close together could both
claim the same freshly-appeared run. Polling a run to completion still
happens concurrently across requests after that — only the attribution step
is serialized. See `workflow-status.js`'s header comment and `publish.js`'s
`handlePublish` for exactly where that ordering matters.

## Duplicate-asset detection

`bootstrap_asset.py`'s own "derived id already exists" refusal only catches
an *exact* id collision — and since a derived id now keeps numbers (a year,
a version), two uploads of the same real document with a different edition
year produce two genuinely different ids, so that check alone won't catch
this. `js/upload.js`'s `findLikelyDuplicate()` adds a fuzzy check on top,
run client-side whenever the selected file or locales change (new-asset
mode only):

1. Tokenize the filename and every existing `registry.yaml` asset id, same
   noise-word filtering as `deriveAssetIdPreview()` — **plus** dropping
   purely numeric tokens (years, versions, page numbers), since that's
   exactly the part most likely to differ between two uploads of the same
   document and would otherwise mask the match.
2. Score every existing asset by **overlap coefficient**
   (`intersection / size of the smaller token set`), not Jaccard — Jaccard
   under-scores an abbreviated re-upload ("Agentic Top 10 Final v3" against
   the full "OWASP Top 10 for Agentic Applications") just for being short;
   overlap coefficient correctly scores it near 1.0 since every word in the
   short title appears in the long one. Threshold: 0.6, deliberately
   generous — a false positive costs one extra click, a missed true
   positive is exactly what this exists to reduce.
3. If the best-scoring match is above threshold, check whether any of the
   **currently selected locales** are already registered for that asset:
   - **Yes** (same document, that exact locale already exists): hard stop.
     The message states the matched asset and colliding locale(s), links to
     the asset's GitHub folder, and offers only a "Return to home" button —
     no path to submit is left open for this combination.
   - **No** (same-looking document, but this locale isn't registered for it
     yet — a completely normal "add a locale" case dressed up as a new
     upload): soft warning. Shows the match, its already-registered
     locales, a "Use this asset instead" button (switches to existing-asset
     mode with it pre-selected — reusing the same locale-disabling logic
     `handleModeChange()` already has), and a required confirmation
     checkbox ("this is a genuinely different, new document") that must be
     checked before submit is allowed.

Verified against the real registry (one real asset, `de-DE`+`fr-FR`
registered): a re-upload naming the same document with a different year and
`de-DE` selected correctly hard-blocks; the same file with `es-ES` selected
correctly soft-warns; an unrelated filename correctly triggers neither.

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
