# tooling/

Scripts and config backing **Process 1 — Draft, Review & Finalize**. See the
repo-root `README.md` for how Process 1 and Process 2 divide up, and the
original PRD/Build Spec (OWASP GenAI Translations Pipeline) for full context.

## registry.yaml (repo root)

Single source of truth every workflow reads. Starts as `assets: {}` — no
asset is pre-declared. `tooling/bootstrap_asset.py` is the only thing that
ever writes to it.

| Field | Type | Meaning |
|---|---|---|
| `source_repo` | string | Where the English source lives (`owner/repo`) |
| `source_path` | string | Path within that repo — a folder of split files, or a single `.docx`/`.pdf` |
| `version` | string | Version identifier of the current English source, e.g. `"2026.1"` |
| `split_by` | `existing_files` \| `heading_1` \| `pdf_heading` | Whether sections already exist as files, need splitting from a Word doc on Heading 1 styles, or need splitting from a finished PDF by detected heading font sizes — real uploads observed in practice are PDFs, not `.docx` |
| `template` | `blue-template` \| `green-template` \| `yellow-template` | Which shared render template this asset uses (lives in the separate `translations-templates` repo) |
| `owners` | list of GitHub usernames | This asset's initiative lead(s) — feeds CODEOWNERS + publish sign-off |
| `locales` | list of BCP-47 codes | Every locale requested for this asset so far — grows via `bootstrap_asset.py`, never hand-edited |

Validated by `registry_schema.py` (a pydantic model) — run
`python tooling/registry_schema.py` to check the file's shape; every workflow
does this before trusting it.

## translation-config.yaml

The single place the translation LLM is named — a `default: {provider,
model}` plus an optional per-asset `overrides:` map. `translate_section.py`
resolves this at runtime via `translation_config.py`; the model is never
hardcoded in a workflow or script. Changing it (globally or per asset) is a
config PR.

## status.json (per `<asset>/<locale>/`)

The single source of truth for section-level progress. States:
`draft` (machine-translated, unreviewed) → `in_review` (PR marked ready) →
`reviewed` (PR merged). `stale` and `migrated` are reserved for Process 2 /
the one-time migration script and aren't produced by anything in this repo
yet. Schema + read/write helpers: `status_schema.py`.

Writer discipline — each state transition has exactly one writer:

- `translate_section.py` (via `translate-draft.yml`) is the only writer of
  new `draft` entries.
- `review_transition.py` (via `review-transitions.yml`) is the only thing
  that moves `draft → in_review` (PR marked ready for review) and
  `in_review → reviewed` (PR merged) — always in response to an explicit
  human action, never automatically.

No human ever hand-edits `status.json`.

## Components in this repo (Process 1)

| File | Component | Does |
|---|---|---|
| `bootstrap_asset.py` + `.github/workflows/bootstrap-asset.yml` | 1 | Validates a new asset/version, opens a PR with the `registry.yaml` entry + scaffolded folder tree. Never touches an already-registered locale. |
| `translation-config.yaml`, `translation_config.py`, `llm_client.py`, `docx_split.py`, `pdf_split.py`, `translate_section.py` + `.github/workflows/translate-draft.yml` | 2 | Splits a `heading_1` asset's `.docx` (or a `pdf_heading` asset's finished PDF, by detected heading font size — see `pdf_split.py`'s module docstring for the heuristic) into English sections once per release, machine-translates every section a locale doesn't already have a status for, opens a draft PR. |
| `review_transition.py` + `.github/workflows/review-transitions.yml` | Process 1B | The only place `status.json`'s human-review states change, triggered by PR "ready for review" and PR merge. |

Deliberately **not** in this repo yet (Process 2 / later phases — see
repo-root README):

- `publish.yml`, `check-freshness.yml`, `render.sh` (component 3, 4, 5)
- `migrate_archive.py` (component 7)
- The GitHub Pages upload/status site (component 6) — the Build Spec's own
  suggested build order builds this last, "once the underlying CLI/Actions
  pipeline works end-to-end." Until then, `bootstrap-asset.yml` and
  `translate-draft.yml` are triggered via `workflow_dispatch` (or
  `repository_dispatch`, once the form exists) instead of a web form.

## Trying it locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r tooling/requirements.txt

# Onboard a new asset (registry entry + folder tree; no translation yet)
python tooling/bootstrap_asset.py \
  --asset my-asset --version 2026.1 --locales es-ES,fr-FR \
  --source-repo GenAI-Security-Project/my-asset-source --source-path _source/ \
  --split-by existing_files --template blue-template --owners your-github-handle \
  --uploaded-path /path/to/split/sections

# Draft-translate one locale (--offline skips the real LLM call, for testing)
export ANTHROPIC_API_KEY=sk-...
python tooling/translate_section.py --asset my-asset --locale es-ES
```

In GitHub Actions, both scripts run behind `bootstrap-asset.yml` and
`translate-draft.yml` via `workflow_dispatch` today (Actions tab → run
workflow), with `ANTHROPIC_API_KEY` set as a repo secret.

## Outstanding decisions (carried over from the Build Spec)

Two named-people gaps block real permission grants (not scaffolding —
`CODEOWNERS` uses a placeholder until these are named):

1. Who are the two initiative leads sharing the CODEOWNERS role for
   `translations`?
2. Does the GenAI ops executive personally approve every `publish.yml` run,
   or delegate standing approval once the asset count grows? (This affects
   Process 2, not Process 1, but is worth deciding before that build starts.)
