"""Append-only audit log of every section-translation attempt.

One JSON object per line at translations/<asset>/<locale>/translation_log.jsonl:
section name, start/finish timestamps, duration, outcome (success/failed),
and — for a success — a validation verdict. Never rewritten, so it
accumulates across every translate_section.py run for that locale, giving a
real record of what happened and when.

Complements status.json rather than replacing it: status.json is the
current review state (draft/in_review/reviewed); this is the history of how
each draft was produced, including attempts that failed outright. It's also
the concrete record behind any "how long does a document this size take"
estimate — see tooling/README.md's Translation log section for the timing
benchmark this was built to support.

Validation is a coarse sanity check, not a correctness guarantee — its job
is to catch a translation call that came back empty, near-empty, wildly
truncated, or garbled, the way the blank-file bug this was built in
response to did. It does not replace human review; a section can pass
validation here and still need real editorial correction.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from text_quality import is_garbled

MIN_LENGTH_RATIO = 0.3  # translated/source shorter than this suggests truncation
MAX_LENGTH_RATIO = 3.0  # translated/source longer than this suggests runaway repetition


@dataclass
class ValidationResult:
    valid: bool
    notes: List[str] = field(default_factory=list)


def validate_translation(source_text: str, translated_text: str) -> ValidationResult:
    notes = []
    stripped = translated_text.strip()
    source_stripped = source_text.strip()

    if not stripped:
        notes.append("translated content is empty")
    else:
        if is_garbled(stripped[:2000]):
            notes.append("translated content looks garbled")
        ratio = len(stripped) / max(len(source_stripped), 1)
        if ratio < MIN_LENGTH_RATIO:
            notes.append(f"translated length is only {ratio:.0%} of source — possible truncation")
        elif ratio > MAX_LENGTH_RATIO:
            notes.append(f"translated length is {ratio:.1f}x source — possible runaway repetition")

    return ValidationResult(valid=not notes, notes=notes)


def log_path(translations_root: Path, asset: str, locale: str) -> Path:
    return translations_root / asset / locale / "translation_log.jsonl"


def append_entry(
    path: Path,
    *,
    section: str,
    start: datetime,
    finish: datetime,
    status: str,
    validation: Optional[ValidationResult] = None,
    error: Optional[str] = None,
) -> None:
    entry = {
        "section": section,
        "start": start.isoformat(),
        "finish": finish.isoformat(),
        "duration_seconds": round((finish - start).total_seconds(), 2),
        "status": status,  # "success" | "failed"
    }
    if validation is not None:
        entry["valid"] = validation.valid
        entry["validation_notes"] = validation.notes
    if error:
        entry["error"] = error

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
