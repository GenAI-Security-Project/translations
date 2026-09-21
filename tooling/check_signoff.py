#!/usr/bin/env python3
"""FR4.2 -- the three-way sign-off gate on a "ready to publish" issue.

Named individuals for the three roles (localization lead, technical/content
reviewer, project/ops executive) are an explicit open question in the PRD
("Outstanding decisions" / "Open questions") -- there's no real roster to
check identities against yet. This checks the STRUCTURE of the sign-off
instead: the issue body must carry the exact three-item checklist
check-freshness.yml writes when it opens the issue, and all three boxes
must be checked. Revisit once named roles/delegation policy exist (the
PRD's own open question) to also verify *who* checked each box.

Exit codes: 0 = all three signed off; 2 = checklist present but incomplete
(a normal, non-error state -- most issue edits won't be the final one);
1 = checklist missing/malformed (something is actually wrong).
"""
from __future__ import annotations

import re
import sys

REQUIRED_ROLES = [
    "Localization lead",
    "Technical/content reviewer",
    "Project/ops executive",
]

CHECKLIST_ITEM_RE = re.compile(r"^- \[( |x|X)\]\s*(.+?)\s*$", re.MULTILINE)


def check(issue_body: str) -> int:
    found = {role: False for role in REQUIRED_ROLES}
    for checked, label in CHECKLIST_ITEM_RE.findall(issue_body):
        for role in REQUIRED_ROLES:
            if label.strip().lower().startswith(role.lower()):
                found[role] = found[role] or checked.lower() == "x"

    missing_entirely = [r for r in REQUIRED_ROLES if r not in "\n".join(
        label for _, label in CHECKLIST_ITEM_RE.findall(issue_body)
    )]
    if len(missing_entirely) == len(REQUIRED_ROLES):
        print("::error::No sign-off checklist found in the issue body -- was this issue opened by check-freshness.yml?")
        return 1

    pending = [role for role, ok in found.items() if not ok]
    if pending:
        print(f"Waiting on sign-off from: {', '.join(pending)}")
        return 2

    print("All three sign-offs recorded.")
    return 0


if __name__ == "__main__":
    body = sys.stdin.read()
    sys.exit(check(body))
