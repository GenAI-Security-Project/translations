#!/usr/bin/env bash
# Process 3 (Assemble & Publish, DOCX variant), component 5b: the open-source
# DOCX generator. Thin wrapper over render/render_docx.js (markdown-it + the
# `docx` package + a headless-Chrome pass to rasterize SVG figures) -- see
# that file and render_config_schema.py for the actual implementation/schema.
# Same asset/locale/config inputs as render.sh (Process 2) -- same
# registry.yaml, same _manifest.json order, same status.json readiness gate,
# same translations-templates render_config.json -- just a .docx output
# instead of a .pdf.
#
# Usage:
#   render-docx.sh --asset <id> --locale <code> [--out <path>] [--final] \
#                   [--root <translations-checkout>] [--templates-root <translations-templates-checkout>]
#
# --final is set only by an approved run: it requires every section
# reviewed and omits the draft banner. Without it, this produces a preview
# docx -- every section available (whatever its status), with a DRAFT
# banner on the cover and in the footer -- useful for reviewers checking
# content before sign-off.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DIR="$SCRIPT_DIR/render"

if [ ! -d "$RENDER_DIR/node_modules" ]; then
  echo "render-docx.sh: installing render/ dependencies (first run)..." >&2
  (cd "$RENDER_DIR" && npm install --no-audit --no-fund --silent)
fi

DEFAULT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HAVE_ROOT=0
HAVE_TEMPLATES_ROOT=0
PASSTHROUGH=()

while [ $# -gt 0 ]; do
  case "$1" in
    --root) HAVE_ROOT=1; PASSTHROUGH+=(--root "$2"); shift 2 ;;
    --templates-root) HAVE_TEMPLATES_ROOT=1; PASSTHROUGH+=(--templates-root "$2"); shift 2 ;;
    *) PASSTHROUGH+=("$1"); shift ;;
  esac
done

if [ "$HAVE_ROOT" -eq 0 ]; then
  PASSTHROUGH+=(--root "$DEFAULT_ROOT")
fi

if [ "$HAVE_TEMPLATES_ROOT" -eq 0 ]; then
  # Default: a sibling checkout, e.g. both repos cloned side by side --
  # matches how a GitHub Actions job with two checkout steps lays them out.
  PASSTHROUGH+=(--templates-root "$(cd "$DEFAULT_ROOT/../translations-templates" && pwd)")
fi

exec node "$RENDER_DIR/render_docx.js" "${PASSTHROUGH[@]}"
