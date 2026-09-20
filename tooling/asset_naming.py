"""Derive a stable asset id from an uploaded file's name.

Used only when a new asset is onboarded without an explicit --asset — so a
first upload doesn't require a human to type an id by hand. The result is
recorded once in registry.yaml and never changes: a later version upload of
the same asset almost always has a *different* filename, so re-deriving
from that upload's name would silently create a second, unrelated asset
instead of a new version of the same one. --asset is required (and used
as-is) for every other case: adding a locale, bumping a version, or
onboarding from a folder of already-split files (existing_files) rather
than a single document, where there's no single meaningful filename to
derive anything from.

Numbers are always kept — a year, a version number, a date stamp is real
identifying information about a specific document (which OWASP Top 10
edition, which report year), not noise to discard. Only non-numeric
editorial/process words ("Final", "Draft", "Rev", a bare "v2"-style version
marker) are dropped, wherever they appear in the filename — a human can
always override with --asset when this best-effort pass gets it wrong.
"""
from __future__ import annotations

import re
from pathlib import Path

_NOISE_WORD_RE = re.compile(r"^(final|draft|rev|revision)\d*$", re.IGNORECASE)
_V_NUM_RE = re.compile(r"^v\d+$", re.IGNORECASE)


def _is_noise_token(token: str) -> bool:
    return bool(_NOISE_WORD_RE.match(token) or _V_NUM_RE.match(token))


def asset_id_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    tokens = [t for t in re.split(r"[\s_-]+", stem) if t]
    tokens = [t for t in tokens if not _is_noise_token(t)]

    slug = re.sub(r"[^a-z0-9-]+", "-", "-".join(tokens).lower())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "asset"
