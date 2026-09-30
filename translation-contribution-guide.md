# Translation Contribution Guide

This guide is for anyone who wants to fix or improve a specific piece of
**already-drafted translated content** — a mistranslation, an awkward phrase,
a missed technical term, a typo. It is not about requesting a brand-new
translation or onboarding a new document/locale — that happens through the
[upload page](https://genai-security-project.github.io/translations/upload.html)
instead (see the root `README.md`).

If you just want to see how far along a locale is before deciding what to
fix, check the [status page](https://genai-security-project.github.io/translations/status.html)
first.

## 1. Find the file

Every translated document lives at:

```
<asset-id>/<locale>/<Section-Name>.md   (or .svg for figures)
```

For example, the Agentic Top 10's French translation of the ASI03 entry is at:

```
owasp-top-10-for-agentic-applications-2026-12-6-1/fr-FR/ASI03_Identity_and_Privilege_Abuse.md
```

A few things that make it easy to find the right file:

- **Section names are identical across every locale and the English source.**
  The same content lives at `.../_source/ASI03_Identity_and_Privilege_Abuse.md`
  (English) and `.../fr-FR/ASI03_Identity_and_Privilege_Abuse.md` (French) —
  only the folder changes.
- **Most sections are a `.md` file.** A handful of front-matter/figure pages
  are `.svg` files with the translated text as individual `<text>` elements
  overlaid on the original image.
- If you're not sure whether a section has already been reviewed or is still
  a rough draft, check `<asset-id>/<locale>/status.json` — that file, not the
  comment at the top of the `.md` file, is the current source of truth for a
  section's status (see [Good to know](#good-to-know) below).

## 2. Fork the repo and create a branch

Standard GitHub flow:

1. Fork `GenAI-Security-Project/translations` (or create a branch directly if
   you have write access).
2. Create a branch named something like `fix/fr-FR-asi03-terminology`.

## 3. Make your edit

- Edit **only the translated prose** — the actual wording of the section.
- **Don't translate technical identifiers.** Risk/entry codes (`ASI01`–`ASI10`),
  LLM Top 10 references (`LLM01:2025`, etc.), threat codes (`T6`, `T12`, ...),
  and protocol/standard names (`MCP`, `A2A`, `RCE`, `OAuth`, `PKI`, `mTLS`,
  `CRUD`, `SBOM`, `AIBOM`, and similar) stay in their original form in every
  locale.
- **Don't translate names** — people, companies, and product names stay in
  Latin script (see `Acknowledgements.md` or `Project_Supporters.md` in any
  locale for the existing pattern).
- **Keep the markdown structure intact** — same headings, same list
  structure, same order of sections, just translated text.
- **Leave the `<!-- status: draft -->` (or similar) comment on line 1 alone.**
  It's a one-time stamp written when the section was first drafted, not a
  live status indicator — don't add, remove, or "correct" it based on what
  you think the section's current status is. See [Good to know](#good-to-know).
- **For `.svg` figures**, only change the text inside `<text>...</text>`
  elements. Don't touch the `<image>` element, coordinates, or any other
  attribute.
- **Never hand-edit `status.json` or `translation_log.jsonl`.** These are
  written automatically by the pipeline (see below) — a manual edit to them
  will be overwritten or cause the automation to skip your PR.

## 4. Open a pull request

- Open a normal PR from your branch/fork against `main`.
- In the title or description, name the asset, locale, and section you
  changed (e.g. `fr-FR ASI03: fix "amitiés" -> "confiance"`), so reviewers
  don't have to guess.
- Explain briefly *why* the change is needed (e.g. "mistranslation," "closer
  to the English meaning," "fixes broken list numbering") — this is a normal
  content review, the same discipline as reviewing a code change.

A maintainer (see `CODEOWNERS`, or the asset's `owners:` in `registry.yaml`)
will be requested as a reviewer automatically.

## 5. What happens after you open the PR

- A human reviews your change against the English original, the same way a
  code change gets reviewed — they may comment, request changes, or edit
  directly on your branch.
- If your PR is labeled for the pipeline's automated status tracking, merging
  it will move the section(s) you touched to `reviewed` in `status.json`
  automatically (`tooling/review_transition.py`, triggered by
  `.github/workflows/review-transitions.yml`) — you don't need to do anything
  for this yourself.
- Once merged, your fix is live in the repo.

## Good to know

- **Fixing an already-`reviewed` section is completely fine** — you don't
  need to do anything special. Open the PR and get it reviewed like any
  other change. (Today, every section in every locale in this repo is still
  `draft` — nothing has gone through the full review cycle yet — but this
  applies once that changes too.)
- **The `<!-- status: draft -->` banner at the top of a `.md` file does not
  track live status.** It's written once, when the section is first drafted,
  and is never updated afterward — even after a section is fully reviewed.
  Always check `status.json` for the real, current status of a section.
- **Don't edit `registry.yaml`** — that file is only ever written by
  `tooling/bootstrap_asset.py`, as part of onboarding a new document or
  locale, not as part of fixing existing content.
- **Questions?** Open an issue, or ask on the PR itself — a maintainer can
  point you to the right place if you're unsure whether something you found
  is a translation issue or a pipeline/tooling issue.
