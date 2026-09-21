# OWASP GenAI Security Project — Translations

![OWASP Project Type](https://img.shields.io/badge/OWASP%20Project-Incubator-orange)

**Project status: Incubator.** This is an active OWASP GenAI Security Project
initiative, still early in its lifecycle — the pipeline works end to end, but
some of the operational scaffolding around it (named approvers, branch
protection, a live translation budget) is still being put in place. See
[Status](#status) below for exactly what that means today.

## What this is

The OWASP GenAI Security Project publishes guidance — Top 10 lists, glossaries,
mapping matrices — in English first. Most of the people who'd benefit from
that guidance don't read English as their first language. This repository is
the project's self-service pipeline for turning an English deliverable into
reviewed, professionally laid-out translations, without needing a paid
localization vendor or a manual, one-off process per document.

It replaces an earlier, archived approach
(`www-project-top-10-for-large-language-model-applications`) that only
handled a single document, one at a time, with closed-source tooling. This
pipeline handles any number of documents and locales, and everything in it —
the splitting, the machine drafting, the review workflow, the final PDF
renderer — is open and auditable in this repo.

## How a translation happens, step by step

1. **Request it.** An initiative lead uploads their source document (a
   finished PDF, or a `.docx`) and picks which locales they want, using the
   [upload page](https://genai-security-project.github.io/translations/upload.html).
   That kicks off onboarding: the document gets a stable id, and its own
   folder is created in this repo to hold every locale's work.
2. **It gets machine-drafted.** The pipeline splits the source into its real
   sections (matching the document's own headings) and drafts a translation
   of every section, for every requested locale, using an LLM. Nothing here
   is published yet — this is a first pass for a human to review, not a
   finished translation.
3. **A human reviews it.** Every drafted section becomes an ordinary GitHub
   pull request. A reviewer reads it against the English original, edits
   directly in the PR if something's off, and marks it ready. This is the
   same review discipline as reviewing a code change — nothing is
   auto-approved.
4. **Progress is visible the whole time.** Anyone can check how far along a
   locale is — how many sections are drafted vs. reviewed — on the
   [status page](https://genai-security-project.github.io/translations/status.html).
   No section's state changes without a real PR being opened, reviewed, or
   merged.
5. **It gets signed off and published.** Once every section in a locale is
   reviewed, that locale is ready to publish. Publishing is a separate,
   deliberately-gated step — it doesn't happen automatically just because
   review finished — and produces the final, branded PDF (cover page, table
   of contents with real page numbers, footer, the works), released as a
   downloadable asset.

Steps 1–4 (**Draft, Review & Finalize**) and step 5 (**Assemble & Publish**)
are two independently-triggered processes on purpose: a locale can sit fully
reviewed for as long as needed before anyone decides it's time to publish.

## Where to go

| I want to... | Go here |
|---|---|
| Request a translation of a new document | [Upload page](https://genai-security-project.github.io/translations/upload.html) |
| Check how a translation is progressing | [Status page](https://genai-security-project.github.io/translations/status.html) |
| Review a section that's been drafted | Open PRs in this repo (search for the locale/section name) |
| Publish a fully-reviewed locale | [Publish page](https://genai-security-project.github.io/translations/publish.html) — requires sign-off; see `tooling/docs/WORKFLOW.md` |
| Understand how the pipeline actually works, in technical detail | `tooling/docs/DESIGN.md` |
| See what's implemented vs. still planned, against the original requirements | `tooling/docs/REQUIREMENTS.md` |
| Walk through the full operational flow (including the publish sign-off) | `tooling/docs/WORKFLOW.md` |
| See what's currently outstanding — blockers, unbuilt pieces, open PRs, decisions still needed | `tooling/docs/OPEN_ITEMS.md` |
| Run any of this locally, or understand a specific script/schema | `tooling/README.md` |

## Status

The pipeline runs end to end against a real document today, in both of its
processes. What's still outstanding before this is fully self-service,
without someone from the build-out team involved:

- Real named `CODEOWNERS` for review/sign-off — currently a placeholder.
- A repo secret for the translation LLM (`ANTHROPIC_API_KEY`, or whichever
  provider `tooling/translation-config.yaml` names) — without it, drafting
  runs in an offline/simulated mode rather than calling a real model.
- A deploy key letting the publish workflow check out `translations-templates`
  (the render templates repo) in a real GitHub Actions run.
- No document has been migrated from the archived repo yet — the migration
  script doesn't exist. The one real document in this repo came in through
  the normal upload path instead. See `tooling/docs/REQUIREMENTS.md` for the
  full list of what's done, partial, or not started.

## Related repo

`translations-templates` (private, admin-group-only) holds the shared render
templates — the branded cover art, fonts, and layout config three named
templates use. It's permanently private by design: it's the project's brand
asset repo, not translated content, and has no reason to be public.
