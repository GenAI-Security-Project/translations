"""Schema and load/merge helpers for translations-templates' render_config.json.

Neither the Build Spec nor the PRD gives a field-by-field table for this file
(unlike registry.yaml's, which both documents spell out explicitly) — only a
prose description: "cover, title placement, legal notice, TOC labels,
per-element fonts, direction, CJK line-breaking rules, hyphenation/numeral-
style." This module is that description turned into an actual schema.

A template's config is layered: <template>/default/render_config.json is the
base; <template>/<locale>/render_config.json (if present) is a partial
override, deep-merged on top for a script-specific need (RTL, CJK line-
breaking, Cyrillic/Vietnamese/Devanagari fonts, German hyphenation, Turkish-
safe numerals) — never a fork of the whole file. See FR5/FR7.3 and NFR5:
publish.yml's override-readiness check (component 4) is what actually
enforces "a script category that needs an override must have one"; this
module only loads and validates whatever config resolves for a given
asset+locale, it doesn't decide whether that resolution is *sufficient*.
"""
from __future__ import annotations

import json
from copy import deepcopy
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class Direction(str, Enum):
    ltr = "ltr"
    rtl = "rtl"


class NumeralStyle(str, Enum):
    western = "western"  # 0-9
    arabic_indic = "arabic-indic"  # ٠-٩ (ar-SA)
    extended_arabic_indic = "extended-arabic-indic"  # ۰-۹ (fa-IR)


class FontFile(BaseModel):
    weight: int = 400
    style: str = "normal"  # normal | italic
    path: str  # relative to translations-templates/assets/fonts/


class FontSpec(BaseModel):
    family: str
    source: str = "bundled"  # bundled | google
    files: List[FontFile] = Field(default_factory=list)  # required when source == "bundled"
    google_href: Optional[str] = None  # required when source == "google"


class PageMargins(BaseModel):
    top_mm: float = 25
    bottom_mm: float = 25
    left_mm: float = 22
    right_mm: float = 22


class PageConfig(BaseModel):
    size: str = "A4"  # A4 | Letter
    margins: PageMargins = Field(default_factory=PageMargins)
    # relative to this template's own folder (translations-templates/<template>/)
    # -- a light corner decoration shown on every page EXCEPT the cover
    # (which uses CoverConfig.background_image_path instead) and the TOC
    # (which uses TocConfig.background_image_path instead). Confirmed
    # against the real .docx: cover vs. every-other-page are two genuinely
    # different images, applied via different header types ("first" vs
    # "default"), not the same band at two sizes.
    decoration_image_path: Optional[str] = None
    # Relative to this template's own folder. Reserved for a page role not
    # yet assigned -- as of 2026-10-01 this is provided (green-special-page-
    # background.png) but byte-identical to the TOC background and not yet
    # wired to any specific page; kept as its own field rather than reusing
    # toc.background_image_path because the two are expected to diverge
    # (different pages, changing independently) even though they currently
    # happen to match. Do not assume it means "same as TOC" going forward.
    special_background_image_path: Optional[str] = None


class HeadingUnderline(BaseModel):
    """A drawn-line rule under a heading -- not a paragraph border. The real
    template's Heading 1 rule is a fixed 193.5pt x 4.5pt line in accent3
    (#9FAEB5), independent of the heading text's own length; it never spans
    the full page width."""

    color: str
    width_pt: float = 193.5
    thickness_pt: float = 4.5


class HeadingStyle(BaseModel):
    font: str = "heading"  # key into fonts{}
    size_pt: float
    color: str = "#000000"
    numbering: bool = False  # "1.", "1.1" auto-numbering prefix
    underline: Optional[HeadingUnderline] = None


class CoverConfig(BaseModel):
    logo_path: Optional[str] = None  # relative to assets/images/
    background_image_path: Optional[str] = None  # relative to this template's own folder (translations-templates/<template>/); a decorative band/pattern, not a solid fill
    background_image_position: str = "top"  # top | full -- top: a band across the top portion only, like the real OWASP cover art
    # A short line above the title (e.g. "GENAI SECURITY PROJECT") -- the
    # publishing project's own name, confirmed as a real, separate text run
    # in the real .docx (not baked into the cover image). Not translated
    # per locale -- it's the project's own name, not this asset's content,
    # the same way the logo wordmark baked into the cover image isn't
    # translated either. None: omitted entirely.
    kicker_text: Optional[str] = None
    title_font: str = "heading"
    subtitle_font: str = "body"
    background_color: str = "#FFFFFF"
    text_color: str = "#000000"
    show_version: bool = True
    show_date: bool = True


class TocConfig(BaseModel):
    include: bool = True
    label: str = "Table of Contents"  # translated per locale
    max_depth: int = 2
    # Relative to this template's own folder. A real, distinct background
    # from both the cover's and every other page's -- confirmed against the
    # real template's own provided assets (green-toc-background.png differs
    # from green-cover-background.jpg, and is applied only to the TOC
    # page(s), not every content page). Rendering this means the TOC can no
    # longer share a single HTML->PDF pass with the legal notice and body
    # sections -- see render.js's main() for the resulting cover/legal/toc/
    # body four-way split. Rendered as flowing content (real document-flow
    # space, like the cover's own image), not a position:fixed overlay --
    # a fixed element can't be made to clear content only on a TOC's later
    # pages without also clearing it by the same amount everywhere else
    # (confirmed empirically: Chrome anchors position:fixed to the content
    # viewport, the same box a PDF margin also moves, so inflating the
    # margin to "make room" moves both by the same amount and never
    # separates them) -- see render.js's renderTocHtml for the actual fix.
    background_image_path: Optional[str] = None


class LegalNoticeConfig(BaseModel):
    text: str  # translated per locale; OWASP license/attribution blurb
    position: str = "after-cover"  # after-cover | footer-first-page


class LineBreakingConfig(BaseModel):
    line_break: str = "auto"  # auto | strict (CJK: strict)
    word_break: str = "normal"  # normal | keep-all (CJK: keep-all)
    word_spacing: str = "normal"  # normal | none (ja-JP: none)
    hyphens: str = "none"  # none | auto (de-DE: auto)
    hyphens_lang: Optional[str] = None  # BCP-47 for the hyphens dictionary, e.g. "de"


class FooterConfig(BaseModel):
    show_page_numbers: bool = True
    page_number_format: str = "{page}"  # or "{page} / {total}"
    show_url: bool = True
    url_text: str = "https://www.genaisecurityproject.com"
    url_href: Optional[str] = "https://www.genaisecurityproject.com"  # None: plain text, not a link


class SponsorsConfig(BaseModel):
    """A sponsors/supporters figure (logos + often an intro blurb, bundled
    as one OCR'd image by Tier 1 image localization -- see image_svg.py)
    changes on its own schedule, tied to the org's actual sponsor roster,
    not to any one asset's translation cycle. Rather than editing 3 asset
    files x 19 locales every time a sponsor is added, one shared image
    here replaces whichever figure(s) match -- update it by swapping this
    one file, nothing per-asset or per-locale to touch.

    Trades away per-locale translation of that figure's own text (the
    image is static, shown identically in every locale) for update
    simplicity -- appropriate for content that's substantially brand
    logos anyway, not prose that needs translating."""

    image_path: Optional[str] = None  # relative to sponsorlogo/ (uploaded directly to translations-templates's main, supersedes any asset's own sponsors figure for all published translations); None: no substitution, render each asset's own figure
    match_keywords: List[str] = Field(default_factory=lambda: ["sponsor", "supporter", "acknowledgement"])


class WatermarkConfig(BaseModel):
    """A diagonal DRAFT stamp applied to every page of a render that hasn't
    gone through publish.yml's three-way sign-off (FR4.2/NFR7) yet. The
    template only owns how it looks; render.sh's --final flag (set only by
    publish.yml's approved run) decides whether it's drawn at all -- see
    render.sh's own --watermark/--final handling, not this config."""

    text: str = "DRAFT — NOT FOR RELEASE"
    font_family: str = "heading"  # key into fonts{}
    font_size_pt: float = 60
    color: str = "#C0392B"
    opacity: float = 0.18
    rotation_deg: float = -35
    repeat: bool = False  # False: one centered diagonal stamp; True: tiled


class RenderConfig(BaseModel):
    template: str
    direction: Direction = Direction.ltr
    numerals: NumeralStyle = NumeralStyle.western
    page: PageConfig = Field(default_factory=PageConfig)
    fonts: Dict[str, FontSpec] = Field(default_factory=dict)  # keys: heading, body, footer, monospace...
    cover: CoverConfig = Field(default_factory=CoverConfig)
    toc: TocConfig = Field(default_factory=TocConfig)
    legal_notice: Optional[LegalNoticeConfig] = None
    headings: Dict[str, HeadingStyle] = Field(default_factory=dict)  # keys: h1, h2, h3
    line_breaking: LineBreakingConfig = Field(default_factory=LineBreakingConfig)
    footer: FooterConfig = Field(default_factory=FooterConfig)
    watermark: WatermarkConfig = Field(default_factory=WatermarkConfig)
    sponsors: SponsorsConfig = Field(default_factory=SponsorsConfig)


def _deep_merge(base: dict, override: dict) -> dict:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = deepcopy(value)
    return merged


def load_render_config(templates_root: Path, template: str, locale: str) -> RenderConfig:
    """<template>/default/render_config.json, deep-merged with
    <template>/<locale>/render_config.json when that override file exists.
    Raises FileNotFoundError if even the default is missing -- that's a
    "this template doesn't exist" bug, never something to fall back from."""
    default_path = templates_root / template / "default" / "render_config.json"
    default_config = json.loads(default_path.read_text(encoding="utf-8"))
    default_config.pop("_comment", None)

    override_path = templates_root / template / locale / "render_config.json"
    if override_path.exists():
        override_config = json.loads(override_path.read_text(encoding="utf-8"))
        override_config.pop("_comment", None)
        merged = _deep_merge(default_config, override_config)
    else:
        merged = default_config

    return RenderConfig(**merged)


def has_locale_override(templates_root: Path, template: str, locale: str) -> bool:
    return (templates_root / template / locale / "render_config.json").exists()
