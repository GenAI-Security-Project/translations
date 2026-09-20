"""Schema and load/save helpers for registry.yaml.

Every workflow and script that touches registry.yaml imports this module
instead of parsing the YAML ad hoc, so a malformed entry fails fast and
loudly (here, or in CI) rather than breaking a downstream Action silently.
"""
from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Dict, List

import yaml
from pydantic import BaseModel, Field, ValidationError

REGISTRY_PATH = Path(__file__).resolve().parent.parent / "registry.yaml"

BCP47_LOCALE_RE = r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$"


class SplitBy(str, Enum):
    existing_files = "existing_files"
    heading_1 = "heading_1"      # Word .docx, split on the Heading 1 style
    pdf_heading = "pdf_heading"  # PDF, split by font-size-detected top-level headings


class Template(str, Enum):
    blue = "blue-template"
    green = "green-template"
    yellow = "yellow-template"


class AssetEntry(BaseModel):
    version: str
    source_repo: str
    source_path: str
    split_by: SplitBy
    template: Template
    owners: List[str] = Field(default_factory=list)
    locales: List[str] = Field(default_factory=list)


class Registry(BaseModel):
    assets: Dict[str, AssetEntry] = Field(default_factory=dict)

    @classmethod
    def load(cls, path: Path = REGISTRY_PATH) -> "Registry":
        raw = yaml.safe_load(path.read_text()) or {}
        try:
            return cls.model_validate(raw)
        except ValidationError as exc:
            raise SystemExit(
                f"registry.yaml failed schema validation:\n{exc}"
            ) from exc

    def save(self, path: Path = REGISTRY_PATH) -> None:
        data = {
            "assets": {
                name: entry.model_dump(mode="json")
                for name, entry in sorted(self.assets.items())
            }
        }
        header = (
            "# registry.yaml\n"
            "#\n"
            "# Single source of truth for every asset this pipeline translates.\n"
            "# Entries are created and edited only by tooling/bootstrap_asset.py —\n"
            "# never by hand. See tooling/README.md for the field schema.\n"
        )
        path.write_text(header + yaml.safe_dump(data, sort_keys=False, allow_unicode=True))


def validate_registry_file(path: Path = REGISTRY_PATH) -> Registry:
    """CLI/CI entry point: `python registry_schema.py` exits non-zero on a bad file."""
    return Registry.load(path)


if __name__ == "__main__":
    validate_registry_file()
    print(f"{REGISTRY_PATH} is valid.")
