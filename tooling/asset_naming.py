"""Derive a stable asset id from an uploaded file's name.

Used only when a new asset is onboarded without an explicit --asset — so a
first upload doesn't require a human to type an id by hand. The result is
recorded once in registry.yaml and never changes: a later version upload of
the same asset almost always has a *different* filename (a new date, a new
"final" suffix, a different revision number), so re-deriving from that
upload's name would silently create a second, unrelated asset instead of a
new version of the same one. --asset is required (and used as-is) for every
other case: adding a locale, bumping a version, or onboarding from a folder
of already-split files (existing_files) rather than a single document,
where there's no single meaningful filename to derive anything from.

Best-effort, not exact: strips the extension and tokens that look like
version/date noise from either end of the filename, then slugifies what's
left. Ambiguous cases lean toward keeping content rather than dropping it
(see the bare-trailing-digit handling below) — a human can always override
with --asset when this gets it wrong.
"""
from __future__ import annotations

import re
from pathlib import Path

_MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec"
_YEAR_RE = re.compile(r"^(19|20)\d{2}$")
_DOTTED_VERSION_RE = re.compile(r"^\d+(\.\d+)+$")  # e.g. "12.6", "12.6.1" — a bare "12" is NOT this
_FINAL_DRAFT_RE = re.compile(r"^(final|draft|rev|revision)\d*$", re.IGNORECASE)
_V_NUM_RE = re.compile(r"^v\d+$", re.IGNORECASE)
_MONTH_DAY_RE = re.compile(rf"^(?:{_MONTHS})[a-z]*\d+$", re.IGNORECASE)  # e.g. "July26"
_BARE_DIGITS_RE = re.compile(r"^\d+$")


def _is_strong_noise_token(token: str) -> bool:
    return bool(
        _YEAR_RE.match(token)
        or _DOTTED_VERSION_RE.match(token)
        or _FINAL_DRAFT_RE.match(token)
        or _V_NUM_RE.match(token)
        or _MONTH_DAY_RE.match(token)
    )


def asset_id_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    tokens = [t for t in re.split(r"[\s_-]+", stem) if t]

    # A bare trailing number is ambiguous on its own — "10" in "...Top 10"
    # is real content, but the "01" in "..._Final_July26_01" is a sequence
    # suffix. Only treat it as noise when it directly follows another token
    # already identified as noise, which is a strong signal it belongs to
    # the same date/version stamp rather than the title itself.
    while tokens:
        last = tokens[-1]
        if _is_strong_noise_token(last):
            tokens.pop()
        elif _BARE_DIGITS_RE.match(last) and len(tokens) >= 2 and _is_strong_noise_token(tokens[-2]):
            tokens.pop()
        else:
            break

    # A leading version/date prefix has no equivalent ambiguity — titles
    # essentially never open with a bare number the way they can end with
    # one — so no contextual check is needed on this side.
    while tokens and _is_strong_noise_token(tokens[0]):
        tokens.pop(0)

    slug = re.sub(r"[^a-z0-9-]+", "-", "-".join(tokens).lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "asset"
