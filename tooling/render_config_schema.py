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


class HeadingStyle(BaseModel):
    font: str = "heading"  # key into fonts{}
    size_pt: float
    color: str = "#000000"
    numbering: bool = False  # "1.", "1.1" auto-numbering prefix


class CoverConfig(BaseModel):
    logo_path: Optional[str] = None  # relative to assets/images/
    background_image_path: Optional[str] = None  # relative to assets/images/; a decorative band/pattern, not a solid fill
    background_image_position: str = "top"  # top | full -- top: a band across the top portion only, like the real OWASP cover art
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
    url_text: str = "genai.owasp.org"


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
