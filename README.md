# OWASP GenAI Security Project — Translations

![GenAI Initiative](https://img.shields.io/badge/GenAI_Project_Initiative-Translations-blue) ![GenAI Project Type](https://img.shields.io/badge/Project_Type-Incubator-orange) 

**Project status: Incubator.** This is an active OWASP GenAI Security Project
initiative, still early in its lifecycle — the pipeline works end to end, but
some of the operational scaffolding around it (named sign-off approvers, the
final-publish deploy key, a paid translation budget) is still being put in
place. See
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

New to it? Watch the six-minute
[explainer video](https://genai-security-project.github.io/translations/docs.html) or download the
[manager overview slides](docs/media/GenAI-Translations-Manager-Overview.pptx).

1. **Request it** (translations managers only). Either:
   - **a new document** — the *Onboard a new document* form, linked from the
     [Onboard page](https://genai-security-project.github.io/translations/upload.html): attach the
     finished English `.pdf`/`.docx` and pick the languages and template
     from lists. Merging the resulting onboarding PR starts drafting; or
   - **a new language for an existing document** — **+ Add languages** under
     the document on the
     [Documents & languages page](https://genai-security-project.github.io/translations/status.html),
     or the *Add languages to a document* form: pick the document and
     languages from drop-down lists. Drafting starts straight away.

   Both are GitHub issue forms — your normal GitHub sign-in, no token.
2. **It gets machine-drafted.** The pipeline splits the source into its real
   sections (matching the document's own headings) and drafts each section
   with an LLM (Gemini by default), one language at a time. Each language's
   draft arrives as its own pull request, labelled `status:draft`.
3. **A human reviews and edits it.** The language's reviewer team and the
   document owners are requested on the draft PR automatically. Reviewers
   edit the section files right in the PR (*Files changed* → *Edit file*, or
   press `.` for the web editor). Nothing is auto-approved.
4. **It's marked reviewed.** Marking the PR *Ready for review* moves its
   sections to `in_review`; approving and merging it moves them to
   `reviewed`. Progress per language is on the
   [Documents & languages page](https://genai-security-project.github.io/translations/status.html).
5. **Layout handoff.** Once every section of a language is reviewed, a
   manager runs the layout handoff from the
   [Publish page](https://genai-security-project.github.io/translations/publish.html): a Word file
   of the translation watermarked **DRAFT – NOT FOR DISTRIBUTION**, plus its
   figures, for the designer to lay out in the template. The laid-out
   draft then goes through a final review.
6. **Sign-off, then publish.** A *Ready to publish* issue opens with a
   three-way sign-off checklist (localization lead, technical/content
   reviewer, project/ops executive). Only when all three are ticked — and
   the last step is a translations manager's — is the final PDF produced and
   released. **Nothing is published without sign-off.**

Steps 1–4 (**Draft, Review & Finalize**) and steps 5–6 (**Layout, Sign-off
& Publish**) are separate on purpose: a language can sit fully reviewed for
as long as needed before anyone decides it's time to publish.

Every step that changes anything is limited to **translations managers**
(the `translations-managers` team, or Maintain/Admin on this repo), checked
by each workflow — see [`docs/README.md`](docs/README.md).

## Where to go

The site is at **https://genai-security-project.github.io/translations/**.

| I want to... | Go here |
|---|---|
| Understand the whole process quickly | [Docs page](https://genai-security-project.github.io/translations/docs.html) — explainer video and [manager overview slides](docs/media/GenAI-Translations-Manager-Overview.pptx) |
| Request a translation of a **new document** | [Onboard page](https://genai-security-project.github.io/translations/upload.html) → *Onboard a new document* form |
| Add a **language** to a document that's already here | [Documents & languages page](https://genai-security-project.github.io/translations/status.html) → **+ Add languages** (or the [*Add languages* form](https://github.com/GenAI-Security-Project/translations/issues/new?template=add-language.yml)) |
| Check how a translation is progressing | [Documents & languages page](https://genai-security-project.github.io/translations/status.html) |
| Review and edit a drafted translation | Its draft PR — linked on the request, or [all translations awaiting review](https://github.com/GenAI-Security-Project/translations/pulls?q=is%3Apr+label%3Astatus%3Adraft%2Cstatus%3Ain_review) |
| Mark a translation as reviewed | In its PR: *Ready for review* (→ in review), then approve and merge (→ reviewed) |
| Fix or improve a specific translated entry later | [`translation-contribution-guide.md`](translation-contribution-guide.md) |
| Hand a fully reviewed language to the layout designer | [Publish page](https://genai-security-project.github.io/translations/publish.html) → *Run layout handoff* (watermarked draft) |
| Sign off and publish | The *Ready to publish* issue for that document/language — three sign-offs required; see `tooling/docs/WORKFLOW.md` |
| See past requests and the pipeline's replies | [Onboarding and add-language issues](https://github.com/GenAI-Security-Project/translations/issues?q=label%3Aonboarding%2Cadd-language) |
| Understand how the site and access work | [`docs/README.md`](docs/README.md) |
| Walk through the full operational flow | `tooling/docs/WORKFLOW.md` |
| Understand how the pipeline works, in technical detail | `tooling/docs/DESIGN.md` |
| See what's implemented vs. still planned, against the original requirements | `tooling/docs/REQUIREMENTS.md` |
| See what's outstanding — blockers, unbuilt pieces, decisions still needed | `tooling/docs/OPEN_ITEMS.md` |
| Run any of this locally, or understand a specific script/schema | `tooling/README.md` |

## Status

The pipeline runs end to end against a real document today. What's still
outstanding before it's fully self-service:

- **Final publishing can't run yet:** the deploy key that lets the publish
  workflow read `translations-templates` (`TEMPLATES_DEPLOY_KEY`) isn't set.
  Drafting, review and the layout handoff all work.
- **Free translation tier:** drafting uses Gemini's free tier, whose daily
  quota can run out part-way through a long document; the partial draft
  still opens its PR and a second run finishes it.
- **Teams to fill:** the manager and per-language reviewer teams exist and
  are wired into `CODEOWNERS`; named sign-off approvers are still to be
  agreed.
- No document has been migrated from the archived repo yet. See
  `tooling/docs/REQUIREMENTS.md` for what's done, partial, or not started,
  and `tooling/docs/OPEN_ITEMS.md` for the full list.

## Related repos

- `translations-templates` (private, admin-group-only) holds the shared
  render templates — the branded cover art, fonts, and layout config three
  named templates use. It's permanently private by design: it's the
  project's brand asset repo, not translated content, and has no reason to
  be public.
- `translations-tooling` (private) is a manually-synced backup of this
  repo's `tooling/` directory — integrity protection to restore from if
  `tooling/` here is ever tampered with or compromised, not live
  infrastructure. No workflow reads from it; it has zero effect on this
  repo unless someone deliberately restores from it.
