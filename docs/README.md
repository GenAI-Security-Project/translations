# docs/ — GitHub Pages site (Component 6)

Static site (no backend, no build step) for the translation pipeline. Since
2026-11-23 **no page asks for a personal access token**: every page only
reads the public `translations` repo, and anything that changes the repo
happens on GitHub itself, under the person's normal GitHub sign-in.

## Pages

- **`index.html`** — landing page linking the rest.
- **`status.html`** — dashboard over every asset/locale's `status.json`,
  live from the repo (NFR6). Each document has **+ Add languages**: a
  checklist of languages (`js/languages.js`, plus an "other codes" box)
  that opens the **"Add languages" issue form** pre-filled (see below).
- **`upload.html`** — onboarding (Process 1, FR1.1–FR1.5). Explains the
  process and links to the **"Onboard a document" issue form**
  (`.github/ISSUE_TEMPLATE/onboard-document.yml`) — see below.
- **`publish.html`** — for now offers only **Process 4 (Assemble for
  Layout)**. Lists every asset/locale with its review count; a fully
  reviewed one gets a *Copy asset id* button and a link to GitHub's own
  *Run workflow* form for `layout-handoff.yml`. Process 2's direct publish
  path is not offered while Process 2 is set up.

- **`docs.html`** — links to the guides and reference docs in this repo
  (workflow walkthrough, this README, tooling reference, design,
  requirements, open items) and to requests, reviews and workflow runs.

## Look and feel

Branded to match genai.owasp.org: the project's official logo
(`assets/owasp-genai-security-project-logo.png`, the white logo from
genai.owasp.org, used unmodified) on a navy header band, and the site's
colours (`css/style.css` lists them). Light and dark themes follow the
system setting; the header's theme button (`js/theme.js`) can pin Light or
Dark, remembered in that browser only.

## Who may do what

Pipeline actions are limited to **translations managers**: Maintain or Admin
on this repo — the `translations-managers` team (Maintain on `translations`
only), outside collaborators given Maintain, and org owners. It's enforced
server-side by `.github/actions/require-manager`, which every
pipeline workflow runs first against `github.triggering_actor`. No page
or workflow uses a personal access token. Managers are
added and removed in GitHub settings; nothing in this site or the repo needs
to change. Reviewers are the per-locale `translations-reviewers-<locale>`
teams (Write), routed by `CODEOWNERS`.

## Onboarding via the issue form

1. A manager opens a new issue from the **Onboard a new document**
   template: the source `.pdf`/`.docx` dragged into the form, version,
   languages (multi-select dropdown, plus an optional box for codes not
   listed), template (dropdown), optional source repo/path and owners, and a
   required acknowledgement that the attachment is public. New documents
   only; languages for existing ones use the other form (below).

   Both forms are **generated** by `tooling/gen_issue_forms.py` from
   `registry.yaml` (the document dropdown) and `tooling/languages.json`
   (the language dropdowns, and `docs/js/languages.js`);
   `sync-issue-forms.yml` re-runs it on every push to `main` that changes
   those, so a newly onboarded document appears in the dropdown by itself.
2. `onboard-from-issue.yml` runs on the issue being opened with the
   `onboarding` label (or that label being added later — how a manager
   retries or runs someone else's request):
   - `require-manager` — non-managers get a comment and nothing else runs.
   - `tooling/parse_onboarding_issue.py` validates every field (locale codes,
     version, ids, usernames, and that the attachment is a single
     `.pdf`/`.docx` hosted on github.com) and builds the same payload the
     old page sent.
   - `bootstrap-asset.yml`, called as a reusable workflow (so the manager
     stays the triggering actor), downloads the attachment to the runner,
     runs `bootstrap_asset.py`, and opens the onboarding PR. The file is
     never committed to `main`; it lands in the asset's `_source/` inside
     that PR.
   - A comment on the issue links the PR (and the issue is closed), or
     explains the failure with a link to the run.
3. Merging the onboarding PR starts drafting automatically:
   `start-translations.yml` reads the merge's `registry.yaml` diff and runs
   `translate-draft.yml` for each new locale, one at a time (the merger must
   be a manager). Each draft is its own PR for review.

## Adding languages via the Status page

1. A manager presses **+ Add languages** under a document on
   `status.html`, ticks languages, and presses **Request translation**.
   That opens `.github/ISSUE_TEMPLATE/add-language.yml` — a **Document**
   dropdown and a multi-select **Languages** dropdown, no file upload —
   pre-filled where GitHub allows (query parameters named by field id); they
   check the choices and press **Create**. The form can also be opened
   directly.
2. `onboard-from-issue.yml` (label `add-language`): `require-manager`;
   `parse_onboarding_issue.py` (with `FORM=add-language`) checks the
   document exists and keeps only languages it doesn't have yet, taking the
   version from `registry.yaml`; `bootstrap-asset.yml` opens the setup PR
   (registry + empty locale folders only), which is **merged straight
   away** since a manager asked for it and there's nothing else to review;
   then `start-translations.yml` drafts each new language in turn.
3. Comments on the issue report progress and list the draft PRs; the issue
   closes when every draft is open.

`bootstrap-asset.yml` still accepts `workflow_dispatch` (Actions tab) and
`repository_dispatch` for manual or scripted runs.

### Why an issue form rather than a page with a token

A static Pages site can't complete "Sign in with GitHub" (device-flow token
exchange doesn't support CORS), so the previous upload page needed a
user-pasted personal access token — and verified it against the private
`translations-templates` repo, which locked out managers without access
there. An issue form uses GitHub's own sign-in and upload handling and needs
no extra infrastructure. Trade-off: files attached to issues in a public
repo are publicly downloadable, which the form makes the submitter
acknowledge.

### Not carried over from the old upload page (follow-ups)

- **Duplicate-document warning** — the old page fuzzy-matched a new file
  name against existing asset ids. `bootstrap_asset.py` still refuses an
  exact id collision; the fuzzy check could move into
  `parse_onboarding_issue.py` as a warning comment.
- **Override-readiness warning** — the old page flagged locales with no
  render override in `translations-templates` yet. Drafting still works for
  them; publishing them needs the override first.

## Publishing access

Every publish route is managers-only and uses GitHub sign-in, never a
personal access token:

- **Process 4, `layout-handoff.yml`** — Run workflow; `require-manager`.
- **Process 2 final, `publish.yml`** — Run workflow (`require-manager`), or
  the sign-off issue: the edit that completes the three-way checklist must
  be a manager's, otherwise nothing is published and a comment asks a
  manager to confirm.
- **Testing-only `publish-direct.yml`** — Run workflow (`require-manager`);
  its old `repository_dispatch` trigger, which needed a token, was removed.

## Publish page

`publish.html` reads `registry.yaml` and each `status.json` from
raw.githubusercontent.com (no token, no API rate limit) and counts reviewed
sections directly, so "ready" means exactly what `layout-handoff.yml`'s
reviewed-only gate checks. It never triggers anything itself.
