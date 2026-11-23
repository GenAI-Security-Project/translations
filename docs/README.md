# docs/ — GitHub Pages site (Component 6)

Static site (no backend, no build step) for the translation pipeline. Since
2026-11-23 **no page asks for a personal access token**: every page only
reads the public `translations` repo, and anything that changes the repo
happens on GitHub itself, under the person's normal GitHub sign-in.

## Pages

- **`index.html`** — landing page linking the rest.
- **`status.html`** — read-only dashboard over every asset/locale's
  `status.json`, live from the repo (NFR6).
- **`upload.html`** — onboarding (Process 1, FR1.1–FR1.5). Explains the
  process and links to the **"Onboard a document" issue form**
  (`.github/ISSUE_TEMPLATE/onboard-document.yml`) — see below.
- **`publish.html`** — for now offers only **Process 4 (Assemble for
  Layout)**. Lists every asset/locale with its review count; a fully
  reviewed one gets a *Copy asset id* button and a link to GitHub's own
  *Run workflow* form for `layout-handoff.yml`. Process 2's direct publish
  path is not offered while Process 2 is set up.

## Who may do what

Pipeline actions are limited to **translations managers**: Maintain or Admin
on this repo — the `translations-managers` team (Maintain on `translations`
only), outside collaborators given Maintain, and org owners. It's enforced
server-side by `.github/actions/require-manager`, which every
pipeline workflow runs first against `github.triggering_actor`. Managers are
added and removed in GitHub settings; nothing in this site or the repo needs
to change. Reviewers are the per-locale `translations-reviewers-<locale>`
teams (Write), routed by `CODEOWNERS`.

## Onboarding via the issue form

1. A manager opens a new issue from the **Onboard a document** template:
   what they're submitting (new document, or new locales/version of an
   existing one), the source `.pdf`/`.docx` dragged into the form (new
   documents), version, locales, template and optional source repo/path and
   owners, and a required acknowledgement that the attachment is public.
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
3. After the onboarding PR is merged, each locale is drafted from Actions →
   `translate-draft` → Run workflow.

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

## Publish page

`publish.html` reads `registry.yaml` and each `status.json` from
raw.githubusercontent.com (no token, no API rate limit) and counts reviewed
sections directly, so "ready" means exactly what `layout-handoff.yml`'s
reviewed-only gate checks. It never triggers anything itself.
