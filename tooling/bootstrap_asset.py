#!/usr/bin/env python3
"""Component 1 — bootstrap_asset.py

Fires off the onboarding trigger (today: this CLI invoked directly or via
.github/workflows/bootstrap-asset.yml; eventually: the GitHub Pages upload
form) when an editor uploads a finished English asset naming an asset name +
version that either doesn't exist yet in registry.yaml, or already exists and
is gaining new locales.

Nobody pre-creates a directory or a registry entry ahead of time — this
script, and only this script, does that. It never touches status.json
(translate-draft.yml is the only writer of new draft entries) and it never
touches an already-registered locale's existing folder.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from asset_naming import asset_id_from_filename
from registry_schema import AssetEntry, Registry, SplitBy, Template, REGISTRY_PATH

TRANSLATIONS_ROOT = REGISTRY_PATH.parent


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--asset",
        help=(
            "Asset id, e.g. llm-top-10. Required to add a locale or bump a version of an "
            "EXISTING asset. Optional when onboarding a brand-new asset from a single "
            "--uploaded-path file (.docx/.pdf) — omit it to derive a stable id from that "
            "file's name once, here, rather than typing one by hand."
        ),
    )
    p.add_argument("--version", required=True, help='e.g. "2026.1"')
    p.add_argument(
        "--locales",
        required=True,
        help="Comma-separated BCP-47 codes checked on the form, e.g. de-DE,es-ES",
    )
    p.add_argument("--source-repo", help="owner/repo of the English source (new assets only)")
    p.add_argument("--source-path", help="Path within source-repo (new assets only)")
    p.add_argument("--split-by", choices=[s.value for s in SplitBy])
    p.add_argument("--template", choices=[t.value for t in Template])
    p.add_argument("--owners", default="", help="Comma-separated GitHub usernames")
    p.add_argument(
        "--uploaded-path",
        help="Local path to the uploaded file (.docx/.pdf) or folder (existing_files) to sync into _source/",
    )
    p.add_argument("--dry-run", action="store_true", help="Print the plan; write nothing")
    return p.parse_args(argv)


def sync_source(asset: str, split_by: SplitBy, uploaded_path: Optional[str], dry_run: bool) -> None:
    if not uploaded_path:
        return
    src = Path(uploaded_path)
    if not src.exists():
        raise SystemExit(f"--uploaded-path {src} does not exist")

    dest_dir = TRANSLATIONS_ROOT / asset / "_source"
    if dry_run:
        print(f"[dry-run] would sync {src} -> {dest_dir}")
        return
    dest_dir.mkdir(parents=True, exist_ok=True)

    if split_by is SplitBy.existing_files:
        if not src.is_dir():
            raise SystemExit("split_by=existing_files requires --uploaded-path to be a directory")
        for item in src.iterdir():
            target = dest_dir / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)
    else:  # heading_1 / pdf_heading: stash the raw file; translate-draft.yml splits it on first run
        if src.is_dir():
            raise SystemExit(f"split_by={split_by.value} requires --uploaded-path to be a single file")
        shutil.copy2(src, dest_dir / src.name)


def ensure_locale_dirs(asset: str, new_locales: List[str], dry_run: bool) -> None:
    for locale in new_locales:
        locale_dir = TRANSLATIONS_ROOT / asset / locale
        if dry_run:
            print(f"[dry-run] would create {locale_dir}/.gitkeep")
            continue
        locale_dir.mkdir(parents=True, exist_ok=True)
        gitkeep = locale_dir / ".gitkeep"
        if not gitkeep.exists():
            gitkeep.write_text(
                "# Populated by translate-draft.yml the first time it runs for this locale.\n"
            )


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    requested_locales = [loc.strip() for loc in args.locales.split(",") if loc.strip()]
    if not requested_locales:
        raise SystemExit("--locales must name at least one locale")

    registry = Registry.load()

    if not args.asset:
        if not args.uploaded_path or Path(args.uploaded_path).is_dir():
            raise SystemExit(
                "--asset is required unless onboarding a brand-new asset from a single "
                "--uploaded-path file (.docx/.pdf) to derive an id from"
            )
        args.asset = asset_id_from_filename(Path(args.uploaded_path).name)
        if args.asset in registry.assets:
            raise SystemExit(
                f"derived asset id '{args.asset}' from the filename already exists in "
                f"registry.yaml. If this is a new version of that asset, pass --asset "
                f"{args.asset} explicitly to confirm; if it's unrelated, pass --asset "
                f"explicitly with a different id."
            )
        print(f"derived asset id '{args.asset}' from {Path(args.uploaded_path).name!r}")

    existing = registry.assets.get(args.asset)

    if existing is None:
        missing = [
            name
            for name, val in (
                ("--source-repo", args.source_repo),
                ("--source-path", args.source_path),
                ("--split-by", args.split_by),
                ("--template", args.template),
            )
            if not val
        ]
        if missing:
            raise SystemExit(f"New asset '{args.asset}' requires: {', '.join(missing)}")

        entry = AssetEntry(
            version=args.version,
            source_repo=args.source_repo,
            source_path=args.source_path,
            split_by=SplitBy(args.split_by),
            template=Template(args.template),
            owners=[o.strip() for o in args.owners.split(",") if o.strip()] or ["TBD"],
            locales=requested_locales,
        )
        new_locales = requested_locales
        action = f"created new asset '{args.asset}' @ {args.version}"
    else:
        entry = existing
        already_present = set(entry.locales)
        new_locales = [loc for loc in requested_locales if loc not in already_present]
        skipped = [loc for loc in requested_locales if loc in already_present]
        if skipped:
            print(f"note: {skipped} already registered for '{args.asset}' — skipping, no folders touched")

        version_bumped = args.version != entry.version
        if version_bumped:
            entry.version = args.version
            action = f"bumped '{args.asset}' to {args.version}"
        else:
            action = f"added locale(s) to '{args.asset}' @ {entry.version} (no version change)"
        if args.source_path:
            entry.source_path = args.source_path
        entry.locales = sorted(set(entry.locales) | set(new_locales))

    if args.dry_run:
        print(f"[dry-run] {action}")
        print(f"[dry-run] new locale folders: {new_locales or '(none)'}")
    else:
        registry.assets[args.asset] = entry
        registry.save()
        print(action)

    ensure_locale_dirs(args.asset, new_locales, args.dry_run)
    if existing is None or args.uploaded_path:
        sync_source(args.asset, entry.split_by, args.uploaded_path, args.dry_run)

    if not args.dry_run:
        print(f"registry.yaml updated: {args.asset} -> locales {entry.locales}")
        print("Next: open a PR with these changes; translate-draft.yml then runs per new locale.")

    # Always the last line, always this exact shape — the one thing a caller
    # (bootstrap-asset.yml) should ever parse to learn the resolved asset id,
    # whether it was given explicitly or derived from the uploaded filename.
    print(f"asset_id={args.asset}")


if __name__ == "__main__":
    main()
