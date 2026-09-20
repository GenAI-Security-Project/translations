# translations

The OWASP GenAI Security Project's self-service translation and publishing
pipeline. Replaces the archived, single-asset, closed-source-dependent
process from `www-project-top-10-for-large-language-model-applications`.

Full requirements: PRD "OWASP GenAI Translations Pipeline". Full design:
its Build Spec tab (condensed into `tooling/README.md` in this repo).

**Visibility: private for now.** This repo is scoped to go **public** per
the Build Spec once Process 1 is built and validated — it's kept private
during this build-out phase only. `translations-templates` (the render
templates repo) is private permanently, by design.

## Two independently-triggered processes

This pipeline is deliberately split into two processes that don't run back
to back:

- **Process 1 — Draft, Review & Finalize** (what's built here so far):
  triggered by an asset/locale upload. Runs `bootstrap_asset.py`, then
  `translate-draft.yml`, then loops through ordinary PR review until every
  section in a locale is `reviewed`. Ends there — nothing downstream fires
  automatically.
- **Process 2 — Assemble & Publish** (not built yet): triggered separately,
  gated by a three-way human sign-off, never by Process 1 finishing. Renders
  the final PDF from `translations-templates`. See `tooling/README.md` for
  why this repo doesn't have `publish.yml`, `check-freshness.yml`, or
  `render.sh` yet.

## Layout

```
registry.yaml              # empty until the first asset is onboarded
tooling/
  registry_schema.py        # registry.yaml's schema + validation
  translation-config.yaml   # names the translation LLM (never hardcoded elsewhere)
  translation_config.py     # resolves it at runtime
  bootstrap_asset.py         # component 1 — onboard an asset/locale
  docx_split.py              # splits a heading_1 .docx into English sections
  pdf_split.py                # splits a pdf_heading PDF into English sections (font-size heuristic)
  llm_client.py               # provider-agnostic translation call
  translate_section.py        # component 2 — drafts sections for one locale
  status_schema.py            # status.json schema + read/write helpers
  review_transition.py        # Process 1B — the only writer of in_review/reviewed
  README.md                   # full schema docs + how to run this locally
.github/workflows/
  bootstrap-asset.yml         # wraps bootstrap_asset.py, opens the onboarding PR
  translate-draft.yml         # wraps translate_section.py, opens the draft PR
  review-transitions.yml      # flips status.json on PR ready-for-review / merge
CODEOWNERS                    # interim — see Outstanding decisions below
```

Per-asset content directories (e.g. `llm-top-10/`) don't exist yet — they're
created the first time that asset is onboarded via `bootstrap_asset.py`,
never by hand.

## Status

Process 1 is scaffolded and locally tested end-to-end (offline mode, no live
LLM calls) for both `split_by` modes. Not yet done before this is genuinely
self-service:

- Real named CODEOWNERS (currently a placeholder — see `tooling/README.md`).
- Branch protection rules requiring the section's reviewer + CODEOWNERS.
- `ANTHROPIC_API_KEY` (or whichever provider `translation-config.yaml`
  names) as a repo secret, so `translate-draft.yml` can actually call an LLM
  instead of running in `--offline` mode.
- Per-locale GitHub Teams (Build Spec's long-term plan for who has Write
  access) — not created yet.
- The GitHub Pages upload form (component 6) and everything in Process 2.

## Related repo

`translations-templates` (private, admin-group-only) holds the shared
render templates. It's stubbed with placeholder configs for now — its real
content is Process 2 scope.
