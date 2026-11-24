# Translation Contribution Guide

This guide is for anyone who wants to fix or improve a specific piece of
**already-drafted translated content** — a mistranslation, an awkward phrase,
a missed technical term, a typo. It is not about requesting a brand-new
translation or onboarding a new document/language — new documents go through
the [Onboard page](https://genai-security-project.github.io/translations/upload.html),
and new languages through **+ Add languages** on the
[Documents & languages page](https://genai-security-project.github.io/translations/status.html)
(see the root `README.md`).

If you just want to see how far along a locale is before deciding what to
fix, check the [Documents & languages page](https://genai-security-project.github.io/translations/status.html)
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
- **Update the section's status in `status.json` in the same PR.** Edits to
  a section that's already on `main` are *not* tracked automatically (only
  the machine-draft PRs are). Open `<asset-id>/<locale>/status.json`, find
  the section's entry, and set the correct status — `"reviewed"` once the
  section has been checked — plus `"reviewer"` (the GitHub username who
  reviewed it), `"reviewed_at"` (`YYYY-MM-DD`) and `"pr"` (this PR's
  number). Leave the other fields (`source_commit`, `translator`) and other
  sections alone. **If you skip this, the section stays `draft`, and the
  layout handoff refuses the whole language.** Example:

  ```json
  "ASI01_Agent_Goal_Hijack": {
    "status": "reviewed",
    "source_commit": "a05b19b",
    "translator": "google:gemini-3.6-flash",
    "reviewer": "your-github-name",
    "reviewed_at": "2026-11-24",
    "pr": 84
  }
  ```
- **Never edit `translation_log.jsonl`** — it's written only by the pipeline.

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
- Machine-draft PRs (labelled `status:draft` / `status:in_review`) update
  `status.json` for the sections they touch automatically when they're
  marked ready for review and merged (`tooling/review_transition.py`, via
  `.github/workflows/review-transitions.yml`).
- **Any other PR that edits a section must set that section's status in
  `status.json` itself** (step 3 above); the reviewer checks it along with
  the wording. Once merged, the section counts as reviewed on the
  Documents & languages and Publish pages and for the layout handoff.
- Once merged, your fix is live in the repo.

## Good to know

- **Fixing an already-`reviewed` section is fine** — open the PR and get it
  reviewed like any other change, updating its `status.json` entry
  (`reviewer`, `reviewed_at`, `pr`) to reflect the new review.
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
