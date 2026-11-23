# Open items

A running punch list of what's still outstanding, kept up to date as items
are resolved or new ones surface — unlike `REQUIREMENTS.md` (a point-in-time
reconciliation against the original PRD), this one is meant to be edited
in place. Check an item off (`[x]`) and leave a short note with the PR/commit
that resolved it, rather than deleting the line — this file doubles as a
change log for "why did we decide that."

See `DESIGN.md` for how things work and `WORKFLOW.md` for the operational
walkthrough; this file is just "what's left."

## Blocking real end-to-end use

- [ ] **`TEMPLATES_DEPLOY_KEY` secret not set** on `translations`. Without it,
  `publish.yml` and `publish-direct.yml` can't check out the private
  `translations-templates` repo in a real GitHub Actions run — every publish
  dispatched from the live site will fail at that checkout step. Needs an
  SSH deploy key generated for `translations-templates` (read-only is
  enough) and its private half added as this secret.
- [x] **Real `CODEOWNERS`.** 2026-11-22: now routes to GitHub teams --
  `translations-managers` by default, `translations-reviewers-<locale>` per
  locale folder (managers kept on each line while those teams are empty).
  Who is in them is a people decision made in GitHub, not a code change.
- [ ] **`GEMINI_API_KEY` repo secret not set.** 2026-11-23: the default
  translator is now Gemini (`google:gemini-3.8-flash`, free tier) via
  `llm_client.py`'s google provider. Until the secret exists,
  `translate-draft.yml` stops with a clear "GEMINI_API_KEY is not set"
  error. Free tier: Google may use submitted text to improve its products,
  and per-project rate limits are unpublished (429s are retried with
  backoff). Every translation onboarded so far was drafted without a live
  provider.

## Operational safeguards

- [x] **`translations-tooling` (private) backup created** 2026-09-22 — a
  manually-synced copy of `tooling/`, to restore from if this repo's
  `tooling/` is ever tampered with or compromised. Not live infrastructure;
  no workflow reads from it. See its own README for the restore procedure.
- [ ] **Keep `translations-tooling` synced.** There's no automation or
  schedule — it only protects against tampering that happened *after* its
  last sync. Re-sync it whenever `tooling/` changes meaningfully (see that
  repo's README for the exact steps), not just once at creation.

## Not built yet

- [ ] **`migrate_archive.py` (component 7).** No archived-repo locale has
  been migrated into this structure — the one real asset came in through the
  normal upload path, not migration. Largest gap against the PRD's "no lost
  work" requirement (NFR9).
- [ ] **Watermark tiled/repeat mode.** `render_config.json`'s
  `watermark.repeat` field exists and is accepted, but `render.js` only ever
  renders a single centered stamp regardless of its value — see
  `buildWatermarkCss`'s own comment in `tooling/render/render.js`.
- [x] **Per-locale GitHub Teams** -- created 2026-11-22:
  `translations-reviewers-{de-de,fa-ir,fr-fr,pl-pl,ru-ru}` (Write on this
  repo only, empty) and `translations-managers` (Maintain on this repo
  only). Pipeline workflows require the manager role
  (`.github/actions/require-manager`), replacing the shared TOTP code.
- [ ] **Fill the teams.** Add managers and per-locale reviewers in GitHub.
  New locale → new `translations-reviewers-<locale>` team (Write) + a
  CODEOWNERS line.
- [ ] **Delete the `UPLOAD_TOTP_SECRET` repo secret** once this change is
  merged -- nothing reads it any more.
- [ ] **`translations-templates` is readable by every org member** (org
  base permission is Read). Fixing it needs the org default set to "No
  permission" -- an org-wide decision pending the other owners.

## Token-free intake (2026-11-23)

- [x] **Upload page no longer needs a personal access token** -- onboarding
  is an issue form handled by `onboard-from-issue.yml`; the publish page
  links GitHub's Run workflow form.
- [x] **Resolved 2026-11-23 (enabled; live test issue #73 → PR #74
  passed). Was: "Allow GitHub Actions to create and approve pull requests"
  is off** (org and repo, checked 2026-11-23). Live test (issue #71, run
  45133890737): manager check, form parsing, reusable bootstrap call and
  `bootstrap_asset.py` all passed, then `create-pull-request` failed with
  "GitHub Actions is not permitted to create or approve pull requests".
  Same setting blocks `translate-draft.yml`'s draft PRs. Enable it in this
  repo's Settings -> Actions -> General -> Workflow permissions (if greyed
  out, an org owner enables it at org level first).
- [ ] **Attachment download not yet exercised live** -- needs one real form
  submission from a browser (the API can't attach files).
- [ ] **Lost from the old upload page:** fuzzy duplicate-document warning
  and the locale override-readiness warning (see `docs/README.md`).
- [ ] **Merging an onboarding PR doesn't start drafting** -- each locale is
  run from Actions -> translate-draft. (The old PR text claimed otherwise.)

## Process 4 (Assemble for Layout)

- [ ] **Built 2026-11-21 on `process4-layout-handoff`; not yet run in real
  GitHub Actions.** Verified locally (ru-RU, plus an RTL smoke test on a
  scratch fa-IR) via LibreOffice; not yet opened in Microsoft Word.
- [x] **Run access** -- translations managers only, via
  `.github/actions/require-manager` (2026-11-22).
- [ ] **TOC is a Word field** -- Word fills it on open (updateFields is set);
  LibreOffice's headless convert leaves it empty. Designers using Word are
  unaffected.

## Known content/data issues

- [ ] **`fr-FR/Acknowledgements_Figure_3.svg` has 7 of 8 originally-found
  corrupted/refusal-text OCR elements still unfixed** (only the page-number
  one was incidentally fixed during earlier cleanup). Currently invisible in
  real output — this figure is excluded from rendering by the sponsors-image
  substitution (see `DESIGN.md`) — but the raw file itself is still bad, and
  would show if that substitution were ever turned off for this asset.
  Needs real translation API access to fix properly (regenerate the
  OCR/translation for those elements), not available in the session that
  found this.
- [ ] **TOC page numbers can come out blank for a handful of level-2
  sub-headings.** Not a bug to fix so much as an accepted tradeoff of the
  text-matching approach in `computeHeadingPageNumbers` (see its comment) —
  never wrong, just occasionally missing. Revisit only if it turns out to
  affect more than a small minority of headings on a real document.
- [x] **Cyrillic validated end-to-end** 2026-09-24 — `ru-RU` onboarded and
  drafted as a real generate-process (Process 1) test (PR #15). Surfaced and fixed a real bug in
  the process: neither Poppins nor Barlow has any Cyrillic glyphs at all, so
  every Cyrillic character was silently falling back to a generic system
  serif (PR #16 + `translations-templates`#3 add a Noto Sans Cyrillic-range
  fallback under the same font-family name). RTL/CJK/complex-shaping are
  still unvalidated — this only covers the Cyrillic path.
- [ ] **RTL/CJK/complex-shaping locales still unexercised end-to-end.** The
  render paths exist in `render_config_schema.py` and `render.js`
  (direction, line-breaking, font-loading) but are unvalidated against real
  fonts/content for any locale that actually needs them. Given the Cyrillic
  gap just found (a brand font missing an entire script, silently, with no
  error anywhere), assume RTL/CJK need the same kind of real end-to-end
  check before trusting them — don't assume they're fine just because the
  config fields exist.

## Design decisions made, not yet acted on

- [ ] **`blue-template`, `green-template`, and `yellow-template` are
  currently visually identical** — same colors, same fonts, every
  `render_config.json` field matches except the `template` name itself.
  Surfaced 2026-09-21 while reviewing blue vs. green; not yet decided
  whether to give each template real distinct branding or keep the shared
  look intentionally. **Needs a decision from the project**, not just an
  engineering fix — ask before implementing distinct color schemes.

## In review

- [ ] **PR #11 — live status bars on the upload/publish pages**
  (`docs-status-bar` branch, `translations` repo). Logic verified against a
  mocked Node harness (attribution, step rendering, success/failure/timeout
  paths); **not yet exercised against a real dispatch + live Actions run in
  an actual browser** — neither browser tool available when it was built
  could reach a local static server. Recommend one real test submission on
  each page before merging.

## Decisions still needed from people (not code)

- Who are the two initiative leads for `CODEOWNERS`?
- Does the GenAI ops executive personally approve every `publish.yml` run,
  or delegate standing approval as asset count grows?
- Keep `blue`/`green`/`yellow` templates visually identical, or give each
  real distinct branding? (see above)

---

*Last swept 2026-09-21. When resolving an item, check it off in place with a
one-line note (PR/commit + date) rather than deleting the line, and add
anything newly discovered under the section it fits best — create a new
section heading if none fits.*

## Add languages + manager-only publishing (2026-11-23)

- [x] Status page **+ Add languages** picker → "Add languages" issue form →
  setup PR merged automatically → `start-translations.yml` drafts each new
  language (one at a time, Gemini free tier).
- [x] Merging any `bootstrap` onboarding PR also starts drafting its new
  locales automatically.
- [x] Publishing is managers-only with no tokens: `publish-direct.yml` is
  now Run workflow only (repository_dispatch removed); `publish.yml`
  checks the manager role on manual runs and on the sign-off edit.
- [ ] Live-test an add-language request end to end.
- [ ] A new document onboarded with several locales: each locale's draft
  run splits the source itself; check the split PRs merge cleanly.
