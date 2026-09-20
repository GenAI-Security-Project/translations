#!/usr/bin/env python3
"""Reads back the authenticity metadata render.js embeds in every PDF
(Keywords: project URL, publication date, sha256, byte length) and,
optionally, confirms the checksum still matches the locale's current
section files -- i.e. the PDF hasn't drifted from what's on disk since
publication.

Usage: verify_pdf.py <path-to-pdf> [--asset <id> --locale <code> --root <translations-checkout> --templates-root <translations-templates-checkout>]
Without --asset/--locale/--root/--templates-root, only prints the embedded
metadata. --templates-root is needed to recompute the checksum correctly
whenever the asset's template has a sponsors.image_path configured -- see
render.js, which excludes a sponsors-matched figure from the checksum
since it's shared template content, not this asset's own; recomputing
without knowing that would always mismatch for such an asset.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

import yaml
from pypdf import PdfReader

from render_config_schema import load_render_config
from source_manifest import read_manifest


def parse_keywords(keywords: str) -> dict:
    parts = [p.strip() for p in keywords.split(",")] if "," in keywords else keywords.split()
    info = {}
    for part in parts:
        if part.startswith("http"):
            info["project_url"] = part
        elif part.startswith("published:"):
            info["published"] = part.split(":", 1)[1]
        elif part.startswith("sha256:"):
            info["sha256"] = part.split(":", 1)[1]
        elif part.startswith("bytes:"):
            info["bytes"] = part.split(":", 1)[1]
    return info


def recompute_checksum(root: Path, asset: str, locale: str, templates_root: "Path | None") -> str:
    order = read_manifest(root / asset / "_source")
    locale_dir = root / asset / locale

    sponsors_keywords = []
    if templates_root is not None:
        registry = yaml.safe_load((root / "registry.yaml").read_text())
        template = registry["assets"][asset]["template"]
        cfg = load_render_config(templates_root, template, locale)
        if cfg.sponsors.image_path:
            sponsors_keywords = [kw.lower() for kw in cfg.sponsors.match_keywords]

    parts = []
    for name in order:
        md_path = locale_dir / f"{name}.md"
        svg_path = locale_dir / f"{name}.svg"
        if svg_path.exists() and any(kw in name.lower() for kw in sponsors_keywords):
            continue  # shared template asset, not this asset's own content -- see render.js
        if md_path.exists():
            raw = md_path.read_text(encoding="utf-8")
            raw = re.sub(r"^<!--\s*status:.*?-->\n?", "", raw)
            parts.append(raw)
        elif svg_path.exists():
            parts.append(svg_path.read_text(encoding="utf-8"))
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path")
    parser.add_argument("--asset")
    parser.add_argument("--locale")
    parser.add_argument("--root", default=".")
    parser.add_argument("--templates-root")
    args = parser.parse_args()

    reader = PdfReader(args.pdf_path)
    keywords = (reader.metadata and reader.metadata.get("/Keywords")) or ""
    info = parse_keywords(keywords)
    if not info:
        print("No tracking metadata found on this PDF.")
        return 1

    print(f"Project URL:      {info.get('project_url', '?')}")
    print(f"Published:        {info.get('published', '?')}")
    print(f"Embedded sha256:  {info.get('sha256', '?')}")
    print(f"Content length:   {info.get('bytes', '?')} bytes")

    if args.asset and args.locale:
        templates_root = Path(args.templates_root) if args.templates_root else None
        current = recompute_checksum(Path(args.root), args.asset, args.locale, templates_root)
        match = current == info.get("sha256")
        print(f"Current sha256:   {current}")
        print("MATCH -- unchanged since publication." if match else "MISMATCH -- content has changed since this PDF was published.")
        return 0 if match else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
