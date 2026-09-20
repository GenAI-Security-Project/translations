"""Translate the <text> overlay nodes in a Tier-1 image-localization SVG
(see image_svg.py) into a target locale, and rehome its image reference from
_source/'s path to the locale directory's.

Regex-based rather than a full XML round-trip: image_svg.py is the only
producer of these files, so the format is fully under our control and a
parse/re-serialize cycle risking attribute reordering or whitespace changes
isn't worth it here.

All of a figure's labels are translated in a single batched call
(llm_client.translate_batch) rather than one call per <text> node — measured
on a real 78-label document, individual calls spent far more wall-clock time
on fixed per-call latency than on the ~3 words each label actually carries.
"""
from __future__ import annotations

import re
from typing import List, Match
from xml.sax.saxutils import escape, unescape

from llm_client import translate_batch
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
    matches: List[Match] = list(_TEXT_RE.finditer(svg_text))
    sources = [unescape(m.group(2)) for m in matches]
    translatable = [i for i, s in enumerate(sources) if s.strip()]  # skip empty nodes — nothing to translate

    if offline:
        translations = {i: f"[{locale}] {sources[i]}" for i in translatable}
    else:
        batch = translate_batch(engine, locale, [sources[i] for i in translatable])
        translations = dict(zip(translatable, batch))

    out: List[str] = []
    cursor = 0
    for i, m in enumerate(matches):
        out.append(svg_text[cursor:m.start()])
        open_tag, content, close_tag = m.group(1), m.group(2), m.group(3)
        if i in translations:
            out.append(f"{open_tag}{escape(translations[i].strip())}{close_tag}")
        else:
            out.append(f"{open_tag}{content}{close_tag}")
        cursor = m.end()
    out.append(svg_text[cursor:])

    return rehome_image_href("".join(out))
