"""Translate the <text> overlay nodes in a Tier-1 image-localization SVG
(see image_svg.py) into a target locale, and rehome its image reference from
_source/'s path to the locale directory's.

Regex-based rather than a full XML round-trip: image_svg.py is the only
producer of these files, so the format is fully under our control and a
parse/re-serialize cycle risking attribute reordering or whitespace changes
isn't worth it here.
"""
from __future__ import annotations

import re
from typing import Match
from xml.sax.saxutils import escape, unescape

from llm_client import translate_text
from translation_config import Engine

_TEXT_RE = re.compile(r"(<text\b[^>]*>)(.*?)(</text>)", re.DOTALL)
_HREF_RE = re.compile(r'((?:xlink:)?href)="images/')


def rehome_image_href(svg_text: str) -> str:
    """_source/<name>.svg's `images/<name>.png` must become
    <locale>/<name>.svg's `../_source/images/<name>.png` — both files live
    one level below the asset root, so this is the only path adjustment
    needed; the base image itself is never copied per locale."""
    return _HREF_RE.sub(r'\1="../_source/images/', svg_text)


def translate_svg(engine: Engine, locale: str, svg_text: str, offline: bool = False) -> str:
    def replace(match: Match) -> str:
        open_tag, content, close_tag = match.groups()
        source = unescape(content)
        # A prose-oriented "<!-- offline stub -->" banner (llm_client's normal
        # offline behavior) would itself become visible label text here — use
        # a short inline marker instead, appropriate for a one-line label.
        translated = f"[{locale}] {source}" if offline else translate_text(engine, locale, source)
        return f"{open_tag}{escape(translated.strip())}{close_tag}"

    return rehome_image_href(_TEXT_RE.sub(replace, svg_text))
