#!/usr/bin/env python3
"""Component 2 — translate-draft.yml's payload script.

For a given {asset, locale}:
  1. If the asset's split_by is heading_1 or pdf_heading and _source/ still
     holds the raw .docx/.pdf, split it into per-section English Markdown
     files first (once per release, not once per locale).
  2. Translate every section that doesn't yet have a status.json entry for
     this locale — never re-translates a section a human is already
     reviewing or has reviewed.
  3. Commit each translated section as its own .md file under
     translations/<asset>/<locale>/ with a `<!-- status: draft -->` banner.
  4. Write/update status.json with draft entries: source_commit and the
     provider:model string that actually produced the draft.

The workflow (not this script) is responsible for opening the PR — this
script only touches files, so it can be run and tested locally.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

import docx_split
import pdf_split
from llm_client import translate_text
from registry_schema import Registry, SplitBy, REGISTRY_PATH
from status_schema import SectionEntry, SectionStatus, StatusFile, status_path
from translation_config import resolve_engine

SPLITTERS = {
    SplitBy.heading_1: (docx_split.split_into_source, "*.docx"),
    SplitBy.pdf_heading: (pdf_split.split_into_source, "*.pdf"),
}

TRANSLATIONS_ROOT = REGISTRY_PATH.parent


def git_short_sha(cwd: Path) -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=cwd, capture_output=True, text=True, check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


def ensure_split(asset: str, split_by: SplitBy, source_dir: Path) -> None:
    if split_by not in SPLITTERS:
        return
    splitter, glob_pattern = SPLITTERS[split_by]
    raw_files = list(source_dir.glob(glob_pattern))
    if not raw_files:
        return  # already split on a prior run
    for raw_file in raw_files:
        written = splitter(raw_file, source_dir)
        print(f"split {raw_file.name} -> {written}")


def list_sections(source_dir: Path) -> List[str]:
    return sorted(p.stem for p in source_dir.glob("*.md"))


def sibling_context(locale_dir: Path, exclude: str, limit: int = 2) -> str:
    """A little already-translated context for terminology consistency."""
    siblings = sorted(p for p in locale_dir.glob("*.md") if p.stem != exclude)
    chunks = []
    for p in siblings[:limit]:
        chunks.append(f"### {p.stem}\n{p.read_text()[:1500]}")
    return "\n\n".join(chunks)


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset", required=True)
    p.add_argument("--locale", required=True)
    p.add_argument("--offline", action="store_true", help="Skip the real LLM call; write a stub translation")
    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    registry = Registry.load()
    entry = registry.assets.get(args.asset)
    if entry is None:
        raise SystemExit(f"'{args.asset}' is not in registry.yaml — run bootstrap_asset.py first")
    if args.locale not in entry.locales:
        raise SystemExit(f"'{args.locale}' is not registered for '{args.asset}' — add it via bootstrap_asset.py")

    source_dir = TRANSLATIONS_ROOT / args.asset / "_source"
    ensure_split(args.asset, entry.split_by, source_dir)

    sections = list_sections(source_dir)
    if not sections:
        raise SystemExit(f"no sections found in {source_dir}")

    engine = resolve_engine(args.asset)
    locale_dir = TRANSLATIONS_ROOT / args.asset / args.locale
    locale_dir.mkdir(parents=True, exist_ok=True)
    status_file_path = status_path(TRANSLATIONS_ROOT, args.asset, args.locale)
    status = StatusFile.load_or_new(status_file_path, args.asset, args.locale)

    source_commit = git_short_sha(TRANSLATIONS_ROOT)
    translated_now = []

    for section in sections:
        if section in status.sections:
            continue  # already drafted/in review/reviewed — never clobber human work

        source_text = (source_dir / f"{section}.md").read_text()
        context = sibling_context(locale_dir, exclude=section)
        translation = translate_text(engine, args.locale, source_text, context, offline=args.offline)

        banner = "<!-- status: draft -->\n"
        (locale_dir / f"{section}.md").write_text(banner + translation)

        status.sections[section] = SectionEntry(
            status=SectionStatus.draft,
            source_commit=source_commit,
            translator=engine.label,
        )
        translated_now.append(section)

    status.save(status_file_path)

    if translated_now:
        print(f"drafted {len(translated_now)} section(s) for {args.asset}/{args.locale}: {translated_now}")
    else:
        print(f"nothing to draft for {args.asset}/{args.locale} — every section already has a status")


if __name__ == "__main__":
    main()
