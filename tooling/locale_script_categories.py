"""Which locales need a translations-templates render_config.json override
before they can publish -- FR5.1's exact enumeration (RTL, Cyrillic,
Vietnamese, complex-shaping, Turkish, German), plus CJK: not named in FR5.1's
own sentence, but the "translations-templates repo layout" section and the
render.sh validation groups both treat CJK font + kinsoku shori line-breaking
as a real per-locale requirement, not something the Latin default can serve
-- leaving it out here would make ja-JP/zh-TW/zh-CN publishable with a
silently-wrong font, exactly what NFR5 exists to prevent.

Locales not listed here (Western European Latin, Greek, Korean -- called out
as "low-risk" in the Build Spec) are assumed servable by a template's
default/render_config.json alone; they can still get a locale override for
polish (e.g. de-DE hyphenation), it just isn't a hard publish requirement.
"""
from __future__ import annotations

from enum import Enum


class ScriptCategory(str, Enum):
    rtl = "rtl"
    cyrillic = "cyrillic"
    vietnamese = "vietnamese"
    complex_shaping = "complex_shaping"
    turkish = "turkish"
    german = "german"
    cjk = "cjk"


REQUIRES_OVERRIDE = {
    "ar-SA": ScriptCategory.rtl,
    "he-IL": ScriptCategory.rtl,
    "fa-IR": ScriptCategory.rtl,
    "ru-RU": ScriptCategory.cyrillic,
    "uk-UA": ScriptCategory.cyrillic,
    "vi-VN": ScriptCategory.vietnamese,
    "hi-IN": ScriptCategory.complex_shaping,
    "bn-BD": ScriptCategory.complex_shaping,
    "th-TH": ScriptCategory.complex_shaping,
    "km-KH": ScriptCategory.complex_shaping,
    "tr-TR": ScriptCategory.turkish,
    "de-DE": ScriptCategory.german,
    "ja-JP": ScriptCategory.cjk,
    "zh-TW": ScriptCategory.cjk,
    "zh-CN": ScriptCategory.cjk,
}


def category_for(locale: str) -> "ScriptCategory | None":
    return REQUIRES_OVERRIDE.get(locale)
