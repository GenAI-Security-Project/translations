"""Schema and load/save helpers for a locale's status.json.

One file at translations/<asset>/<locale>/status.json — the single source of
truth for section-level progress. The file banner, PR labels, and the status
dashboard are all generated from this; it is never edited by hand.

Writer discipline (see Build Spec):
  - translate-draft.yml is the only writer of new `draft` entries.
  - a merged PR's own workflow step flips in_review -> reviewed.
  - check-freshness.yml is the only writer of `stale`.
  - migrate_archive.py is the only writer of the one-time `migrated` state.
"""
from __future__ import annotations

import json
from collections import Counter
from enum import Enum
from pathlib import Path
from typing import Dict, Optional

from pydantic import BaseModel, Field


class SectionStatus(str, Enum):
    draft = "draft"
    in_review = "in_review"
    reviewed = "reviewed"
    stale = "stale"
    migrated = "migrated"


class SectionEntry(BaseModel):
    status: SectionStatus
    source_commit: str
    translator: Optional[str] = None
    reviewer: Optional[str] = None
    reviewed_at: Optional[str] = None
    pr: Optional[int] = None
    current_source_commit: Optional[str] = None


class StatusFile(BaseModel):
    asset: str
    locale: str
    sections: Dict[str, SectionEntry] = Field(default_factory=dict)

    @property
    def summary(self) -> Dict[str, int]:
        counts = Counter(entry.status.value for entry in self.sections.values())
        return {"total": len(self.sections), **{s.value: counts.get(s.value, 0) for s in SectionStatus}}

    @classmethod
    def load(cls, path: Path) -> "StatusFile":
        return cls.model_validate_json(path.read_text())

    @classmethod
    def load_or_new(cls, path: Path, asset: str, locale: str) -> "StatusFile":
        if path.exists():
            return cls.load(path)
        return cls(asset=asset, locale=locale, sections={})

    def save(self, path: Path) -> None:
        payload = self.model_dump(mode="json", exclude_none=True)
        payload["summary"] = self.summary
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n")


def status_path(translations_root: Path, asset: str, locale: str) -> Path:
    return translations_root / asset / locale / "status.json"
