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
| `bootstrap_asset.py`, `asset_naming.py` + `.github/workflows/bootstrap-asset.yml` | 1 | Validates a new asset/version, opens a PR with the `registry.yaml` entry + scaffolded folder tree. Never touches an already-registered locale. |
| `translation-config.yaml`, `translation_config.py`, `llm_client.py`, `docx_split.py`, `pdf_split.py`, `image_svg.py`, `svg_localize.py`, `translate_section.py` + `.github/workflows/translate-draft.yml` | 2 | Splits a `heading_1` asset's `.docx` (or a `pdf_heading` asset's finished PDF, by detected heading font size — see `pdf_split.py`'s module docstring for the heuristic) into English sections and figures once per release, machine-translates every section/figure a locale doesn't already have a status for, opens a draft PR. |
| `review_transition.py` + `.github/workflows/review-transitions.yml` | Process 1B | The only place `status.json`'s human-review states change, triggered by PR "ready for review" and PR merge. |

## Figures (images with embedded text)

Both real test documents turned out to contain diagrams with text baked into
a flattened image (an architecture diagram, a risk-mapping graphic) — the
Build Spec didn't anticipate this, so it's handled as an addition to
Process 1, not a Process 2 rendering concern:

- **Tier 1 only** (what's implemented): `image_svg.py` OCRs each embedded
  image, blanks out whatever text it found (even text too garbled to
  transcribe safely — see below), and hands back an SVG that overlays the
  confidently-recognized text as real `<text>` nodes on top of the
  now-text-free base image. The underlying graphic itself is never
  vectorized or redrawn — only its text layer becomes swappable per locale.
- `docx_split.py`/`pdf_split.py` extract every embedded image in document
  order, tag each with whichever section was open when it appeared, and run
  it through `image_svg.convert_image()`. An image needs at least 3
  confidently-recognized text clusters and to be at least 300px in each
  dimension to be converted at all — anything smaller/textless (icons, a
  bullet glyph, a photo) is left as an ordinary, non-localized image.
- A converted image becomes a `<name>_Figure.svg` "section" right alongside
  the `.md` sections it was found next to — same `status.json` states, same
  draft → in_review → reviewed loop, same PR review. `translate_section.py`
  and `review_transition.py` treat `.md` and `.svg` sections identically.
- The blanked base image is a **single shared, locale-agnostic file** at
  `_source/images/<name>.png` — every locale's `.svg` references it via a
  relative path (`translate_section.py`/`svg_localize.py` rehomes the href
  automatically), so fixing the graphic (or the auto-blanking quality) once
  in `_source/images/` fixes it for every locale's rendering. That fix is an
  ordinary whole-file replace in a PR, the same as any other artifact here.
  The pristine, un-blanked original is also kept alongside it
  (`_source/images/<name>_original.png`) so a reviewer has something to
  diff the SVG's extracted text against.

**Known limitations — a figure needs *more* scrutiny in review than a prose
section, not less:**

- OCR confidence does not reliably track semantic correctness — a garbled
  read can still score high enough to get transcribed and translated,
  producing fluent nonsense in the target language. The conservative
  default (only overlay high-confidence clusters; blank everything
  text-shaped regardless of confidence, so nothing doubled/overlapping ever
  ships) avoids the worst failure mode, but doesn't catch every bad
  transcription — verified on a real diagram where a stylized callout box
  had just enough recognizable words to pass the bar while getting several
  words wrong.
- A short, isolated label immediately next to an icon can get an inflated
  OCR-detected height, producing oversized overlay text (observed on
  "Agent"/"Tools" labels next to icon glyphs in a real diagram) — a rendering
  glitch, not a translation error, but still something a reviewer needs to
  eyeball.
- Text below the confidence bar is blanked but not replaced, leaving a
  visible gap rather than stale English — correct by design, but a reviewer
  needs to notice the gap and manually complete it (using the `_original`
  file as reference) rather than assume the figure is fully localized.
- Runs entirely through `pytesseract`, which wraps the `tesseract-ocr` CLI
  binary — `translate-draft.yml` installs it via `apt-get`; it is not on a
  bare `pip install -r requirements.txt` and must stay in the workflow.
- **Tier 2 (fully vectorizing the underlying graphic, not just its text
  layer) is out of scope** — raster-tracing shapes/gradients/icons
  reliably enough to trust automatically is a substantially harder problem
  with no good automated failure signal; revisit only if Tier 1's
  text-overlay approach proves insufficient in practice.

Deliberately **not** in this repo yet (Process 2 / later phases — see
repo-root README):

- `publish.yml`, `check-freshness.yml`, `render.sh` (component 3, 4, 5)
- `migrate_archive.py` (component 7)
- The GitHub Pages upload/status site (component 6) — the Build Spec's own
  suggested build order builds this last, "once the underlying CLI/Actions
  pipeline works end-to-end." Until then, `bootstrap-asset.yml` and
  `translate-draft.yml` are triggered via `workflow_dispatch` (or
  `repository_dispatch`, once the form exists) instead of a web form.

## Asset naming

`--asset` is required to add a locale or bump a version of an **existing**
asset — there's no reliable way to infer "this new upload continues that
asset" from a filename alone, since a real version re-upload almost always
has a different filename (a new date, a new revision number, ...).

For a **brand-new** asset uploaded as a single `.docx`/`.pdf`, `--asset` is
optional: `asset_naming.py` derives a stable id from the uploaded file's
name once, here, and that id is what goes in `registry.yaml` from then on —
the repo folder is named after the *document*, not an arbitrary short id
someone has to think up. Numbers are always kept — a year, a version
number, a date stamp is real identifying information about a specific
document, not noise to discard. Only non-numeric editorial/process words
(`Final`, `Draft`, `Rev`, a bare `v2`-style marker) are dropped, wherever
they appear in the filename, then what's left is slugified:

| Uploaded filename | Derived asset id |
|---|---|
| `OWASP-Top-10-for-Agentic-Applications-2026-12.6-1.pdf` | `owasp-top-10-for-agentic-applications-2026-12-6-1` |
| `2026 OWASP GenAI LLM Top 10-Final_July26_01.docx` | `2026-owasp-genai-llm-top-10-july26-01` |

Best-effort, not exact — if it derives something you don't want, pass
`--asset` explicitly instead (bootstrap_asset.py also refuses to proceed if
a derived id collides with an asset already in `registry.yaml`, rather than
silently treating an unrelated upload as a new version of it).

`existing_files` uploads (a folder of already-split sections, not a single
document) have no single filename to derive from, so `--asset` stays
required there regardless.

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
