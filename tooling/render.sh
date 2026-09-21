#!/usr/bin/env bash
# Process 2 (Assemble & Publish), component 5: the open-source generator.
# Thin wrapper over render/render.js (markdown-it + Puppeteer) -- see that
# file and render_config_schema.py for the actual implementation/schema.
#
# Usage:
#   render.sh --asset <id> --locale <code> [--out <path>] [--final] \
#             [--root <translations-checkout>] [--templates-root <translations-templates-checkout>]
#
# --final is set only by publish.yml's approved run: it requires every
# section reviewed and omits the draft watermark. Without it, this produces
# a preview PDF -- every section available (whatever its status), watermarked
# DRAFT -- useful for reviewers checking layout before sign-off.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DIR="$SCRIPT_DIR/render"

if [ ! -d "$RENDER_DIR/node_modules" ]; then
  echo "render.sh: installing render/ dependencies (first run)..." >&2
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

exec node "$RENDER_DIR/render.js" "${PASSTHROUGH[@]}"
