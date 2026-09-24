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
- [ ] **Real named `CODEOWNERS`.** Currently a placeholder — blocks
  meaningful PR-review/sign-off enforcement. Needs two named initiative
  leads (a people decision, not a code change).
- [ ] **`ANTHROPIC_API_KEY` (or whichever provider `translation-config.yaml`
  names) not set as a repo secret.** Without it, `translate-draft.yml` drafts
  in an offline/simulated mode rather than calling a real model — every
  translation onboarded so far was drafted this way, not with a live LLM.

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
- [ ] **Per-locale GitHub Teams** for write access (the PRD's long-term plan)
  — not created yet; access today is whatever the repo's default
  permissions grant.

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
  drafted as a real Process 1 test (PR #15). Surfaced and fixed a real bug in
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
