#!/usr/bin/env python3
"""Reads back the authenticity metadata render.js embeds in every PDF
(Keywords: project URL, publication date, sha256, byte length) and,
optionally, confirms the checksum still matches the locale's current
section files -- i.e. the PDF hasn't drifted from what's on disk since
publication.

Usage: verify_pdf.py <path-to-pdf> [--asset <id> --locale <code> --root <translations-checkout>]
Without --asset/--locale/--root, only prints the embedded metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

from pypdf import PdfReader

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


def recompute_checksum(root: Path, asset: str, locale: str) -> str:
    order = read_manifest(root / asset / "_source")
    locale_dir = root / asset / locale
    parts = []
    for name in order:
        md_path = locale_dir / f"{name}.md"
        svg_path = locale_dir / f"{name}.svg"
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
        current = recompute_checksum(Path(args.root), args.asset, args.locale)
        match = current == info.get("sha256")
        print(f"Current sha256:   {current}")
        print("MATCH -- unchanged since publication." if match else "MISMATCH -- content has changed since this PDF was published.")
        return 0 if match else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
