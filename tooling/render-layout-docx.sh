#!/usr/bin/env bash
# Process 4 (Assemble for Layout): build a plain, watermarked .docx
# manuscript of one reviewed asset/locale for a human layout designer to
# place into the template by hand. Thin wrapper over
# render/render_layout_docx.js -- see that file's header for what is (and
# deliberately isn't) in the output.
#
# Unlike render.sh (Process 2) and render-docx.sh (Process 3), this needs no
# translations-templates checkout: the output carries no brand assets.
#
# Usage:
#   render-layout-docx.sh --asset <id> --locale <code> [--out-dir <dir>] [--root <translations-checkout>]
#
# Refuses to run unless every section in <asset>/<locale>/status.json is
# "reviewed" -- there is no preview/override mode.
#
# Output (default <root>/<asset>/<locale>/release/layout-handoff/, which is
# gitignored):
#   <asset>_<locale>_<version>_LAYOUT.docx   the manuscript
#   figures/*.svg (+ .png)                    figure sources for layout
#   HANDOFF.md                                file list + checksum
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDER_DIR="$SCRIPT_DIR/render"

if [ ! -d "$RENDER_DIR/node_modules" ]; then
  echo "render-layout-docx.sh: installing render/ dependencies (first run)..." >&2
  (cd "$RENDER_DIR" && npm install --no-audit --no-fund --silent)
fi

HAVE_ROOT=0
for arg in "$@"; do
  [ "$arg" = "--root" ] && HAVE_ROOT=1
done

if [ "$HAVE_ROOT" -eq 0 ]; then
  set -- "$@" --root "$(cd "$SCRIPT_DIR/.." && pwd)"
fi

exec node "$RENDER_DIR/render_layout_docx.js" "$@"
