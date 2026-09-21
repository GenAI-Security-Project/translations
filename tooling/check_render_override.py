#!/usr/bin/env python3
"""Process 2, FR5 -- override-readiness check.

Run before render.sh --final ever executes. Exits non-zero with an explicit,
admin-routed error (NFR5: never a silent fallback to a mis-rendered default)
if the locale needs a script-specific render_config.json override that
translations-templates doesn't have yet.

Usage: check_render_override.py --asset <id> --locale <code> --templates-root <path>
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from locale_script_categories import category_for
from render_config_schema import has_locale_override


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True)
    parser.add_argument("--locale", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--templates-root", required=True)
    args = parser.parse_args()

    registry = yaml.safe_load((Path(args.root) / "registry.yaml").read_text())
    entry = (registry.get("assets") or {}).get(args.asset)
    if entry is None:
        print(f"::error::Asset '{args.asset}' not found in registry.yaml", file=sys.stderr)
        return 1
    template = entry["template"]

    category = category_for(args.locale)
    if category is None:
        print(f"{args.locale} has no override requirement for {template} -- OK to publish on defaults.")
        return 0

    if has_locale_override(Path(args.templates_root), template, args.locale):
        print(f"{args.locale} ({category.value}) has a {template}/{args.locale}/render_config.json override -- OK.")
        return 0

    print(
        f"::error::{args.locale} is a {category.value} locale and needs a "
        f"render_config.json override in translations-templates/{template}/{args.locale}/ "
        "before it can publish. Publishing this locale is blocked until the admin group adds one "
        "(FR5.2/NFR5 -- never a silent fallback to a mis-rendered default).",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
