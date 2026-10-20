#!/usr/bin/env bash
# The publish process (Process 2: Assemble & Publish), component 5: the
# open-source generator.
# Thin wrapper over render/render.js (PDF, markdown-it + Puppeteer) and
# render/render_docx.js (DOCX, markdown-it + the `docx` package) -- see
# those files and render_config_schema.py for the actual
# implementation/schema. Always renders BOTH a .pdf and a .docx for every
# asset/locale by default -- pass --pdf-only for the old PDF-only behavior.
# A DOCX-only run is still render-docx.sh.
#
# Usage:
#   render.sh --asset <id> --locale <code> [--out <pdf-path>] [--final] \
#             [--pdf-only] \
#             [--root <translations-checkout>] [--templates-root <translations-templates-checkout>]
#
# --out, if given, names the PDF; the DOCX (unless --pdf-only) is written
# alongside it with the same basename and a .docx extension (or
# "<value>.docx" if --out doesn't end in .pdf) -- never the same path as the
# PDF. Without --out, both renderers already fall back to their own default
# release/ path, which differs only by extension, so no collision either way.
#
# Neither output is committed by this script -- that's still the caller's
# job (e.g. publish.yml only stages *.pdf; .docx stays gitignored, see
# tooling/README.md for why).
#
# --final is set only by publish.yml's approved run: it requires every
# section reviewed and omits the draft watermark. Without it, this produces
# preview files -- every section available (whatever its status), watermarked
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
PDF_ONLY=0
PDF_ARGS=()
DOCX_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --pdf-only) PDF_ONLY=1; shift ;;
    --root)
      HAVE_ROOT=1
      PDF_ARGS+=(--root "$2"); DOCX_ARGS+=(--root "$2")
      shift 2 ;;
    --templates-root)
      HAVE_TEMPLATES_ROOT=1
      PDF_ARGS+=(--templates-root "$2"); DOCX_ARGS+=(--templates-root "$2")
      shift 2 ;;
    --out)
      # Only the PDF gets the exact --out path; the DOCX gets the same
      # basename with its own extension so the second render can't clobber
      # the first (see file header).
      PDF_ARGS+=(--out "$2")
      case "$2" in
        *.pdf) DOCX_ARGS+=(--out "${2%.pdf}.docx") ;;
        *) DOCX_ARGS+=(--out "$2.docx") ;;
      esac
      shift 2 ;;
    *) PDF_ARGS+=("$1"); DOCX_ARGS+=("$1"); shift ;;
  esac
done

if [ "$HAVE_ROOT" -eq 0 ]; then
  PDF_ARGS+=(--root "$DEFAULT_ROOT")
  DOCX_ARGS+=(--root "$DEFAULT_ROOT")
fi

if [ "$HAVE_TEMPLATES_ROOT" -eq 0 ]; then
  # Default: a sibling checkout, e.g. both repos cloned side by side --
  # matches how a GitHub Actions job with two checkout steps lays them out.
  TEMPLATES_ROOT="$(cd "$DEFAULT_ROOT/../translations-templates" && pwd)"
  PDF_ARGS+=(--templates-root "$TEMPLATES_ROOT")
  DOCX_ARGS+=(--templates-root "$TEMPLATES_ROOT")
fi

node "$RENDER_DIR/render.js" "${PDF_ARGS[@]}"
if [ "$PDF_ONLY" -eq 0 ]; then
  node "$RENDER_DIR/render_docx.js" "${DOCX_ARGS[@]}"
fi
