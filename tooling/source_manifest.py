"""_source/_manifest.json: the one record of canonical section order.

Process 2's render.sh assembles a locale's sections "in canonical (English
source) order" (Build Spec, component 3) -- but nothing before this recorded
that order anywhere. docx_split.py/pdf_split.py already discover it (they
walk the source document top to bottom), they just never wrote it down
before returning. This is that missing record: written once per release by
split_into_source, read once per render by render.js.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List


def write_manifest(source_dir: Path, order: List[str]) -> None:
    (source_dir / "_manifest.json").write_text(json.dumps({"order": order}, indent=2) + "\n")


def read_manifest(source_dir: Path) -> List[str]:
    manifest_path = source_dir / "_manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"{manifest_path} is missing -- an asset split before source_manifest.py existed. "
            "Re-run the split, or add the manifest by hand from _source/'s real document order."
        )
    return json.loads(manifest_path.read_text())["order"]
