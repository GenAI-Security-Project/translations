#!/usr/bin/env python3
"""Process 1, part B — the only place status.json's human-review states change.

Called by .github/workflows/review-transitions.yml at two points in a PR's
life, never by hand:
  - PR marked "ready for review": draft -> in_review, for the sections that
    PR actually touches.
  - PR merged: in_review (or draft, if merged without pausing at ready-for-
    review) -> reviewed, recording who merged it and when.

No section here ever reaches `reviewed` without a merged PR — there is no
automatic transition.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from registry_schema import REGISTRY_PATH
from status_schema import SectionStatus, StatusFile, status_path

TRANSLATIONS_ROOT = REGISTRY_PATH.parent

ALLOWED_TRANSITIONS = {
    SectionStatus.in_review: {SectionStatus.draft},
    SectionStatus.reviewed: {SectionStatus.in_review, SectionStatus.draft},
}


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--asset", required=True)
    p.add_argument("--locale", required=True)
    p.add_argument("--sections", required=True, help="Comma-separated section names touched by this PR")
    p.add_argument("--to-status", required=True, choices=["in_review", "reviewed"])
    p.add_argument("--pr", type=int, help="PR number (recorded when moving to in_review)")
    p.add_argument("--reviewer", help="GitHub username who merged the PR (required for reviewed)")
    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    to_status = SectionStatus(args.to_status)
    if to_status is SectionStatus.reviewed and not args.reviewer:
        raise SystemExit("--reviewer is required when moving sections to reviewed")

    path = status_path(TRANSLATIONS_ROOT, args.asset, args.locale)
    status = StatusFile.load(path)

    requested = [s.strip() for s in args.sections.split(",") if s.strip()]
    moved, skipped = [], []

    for name in requested:
        entry = status.sections.get(name)
        if entry is None or entry.status not in ALLOWED_TRANSITIONS[to_status]:
            skipped.append(name)
            continue
        entry.status = to_status
        if to_status is SectionStatus.in_review:
            entry.pr = args.pr
        elif to_status is SectionStatus.reviewed:
            entry.reviewer = args.reviewer
            entry.reviewed_at = dt.date.today().isoformat()
        moved.append(name)

    status.save(path)
    print(f"{args.asset}/{args.locale}: moved {moved} -> {to_status.value}; skipped (bad prior state) {skipped}")


if __name__ == "__main__":
    main()
