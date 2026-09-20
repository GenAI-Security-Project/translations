"""Thin translation-call wrapper so translate_section.py doesn't care which
provider is configured. Add a branch here if translation-config.yaml ever
names a provider other than anthropic/openai/google.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from translation_config import Engine

SYSTEM_PROMPT = (
    "You are translating a security-guidance document section for the OWASP "
    "GenAI Security Project from English into {locale}. Translate faithfully "
    "and completely — do not summarize, omit, or add content. Preserve "
    "Markdown structure (headings, lists, code spans, links) exactly. Keep "
    "product/vulnerability identifiers such as 'LLM01' untranslated. Match "
    "the terminology used in the glossary and prior sections below, if given."
)

BATCH_SYSTEM_PROMPT = (
    "You are translating a list of short text labels from a security-guidance "
    "diagram for the OWASP GenAI Security Project from English into {locale}. "
    "Translate each item faithfully and completely. Keep product/vulnerability "
    "identifiers such as 'LLM01' or 'ASI01' untranslated. Respond with ONLY a "
    "JSON array of strings, in exactly the same order and count as the input "
    "array — no other text, no markdown code fence, no explanation."
)


MAX_EMPTY_RETRIES = 2  # total attempts = this + 1


def _anthropic_call(engine: Engine, system: str, user_content: str) -> str:
    """One call, returning joined text blocks (which may legitimately be
    empty, e.g. a refusal) — callers decide whether to retry or raise."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=engine.model,
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return "".join(block.text for block in response.content if block.type == "text")


def translate_text(engine: Engine, locale: str, source_text: str, context: str = "", offline: bool = False) -> str:
    if offline:
        return f"<!-- offline stub translation for {locale} -->\n\n{source_text}"

    system = SYSTEM_PROMPT.format(locale=locale)
    if context:
        system += f"\n\nGlossary / already-translated sibling sections for consistency:\n{context}"

    if engine.provider == "anthropic":
        # A real (rare, observed in practice) failure mode: the API call
        # succeeds — no exception, no error status — but the model returns
        # no text content at all for a specific section. That's silently
        # indistinguishable from a real empty translation unless it's
        # checked for explicitly; left unchecked it produces a section that
        # looks drafted (a status.json entry, a committed file) but is
        # actually blank, which only surfaces on a human noticing the file
        # itself is empty in review — as happened here. Retry a couple of
        # times before giving up loudly.
        for attempt in range(MAX_EMPTY_RETRIES + 1):
            result = _anthropic_call(engine, system, source_text)
            if result.strip():
                return result
        raise RuntimeError(
            f"translate_text: model returned empty content for {locale} after "
            f"{MAX_EMPTY_RETRIES + 1} attempts (source: {len(source_text)} chars) — "
            "not writing a blank section"
        )

    raise SystemExit(
        f"llm_client.py has no implementation for provider '{engine.provider}' yet — "
        "add one here before naming it in translation-config.yaml."
    )


def _parse_json_array(raw: str, expected_len: int) -> Optional[List[str]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if isinstance(data, list) and len(data) == expected_len and all(isinstance(x, str) for x in data):
        return data
    return None


def translate_batch(engine: Engine, locale: str, texts: List[str]) -> List[str]:
    """Translate many short strings (a figure's text labels) in one call
    instead of one call each — each API round-trip has a fixed latency cost
    regardless of how little text it carries, so a diagram with dozens of
    short labels was paying that cost dozens of times for a handful of
    words. Falls back to one-call-per-item only if the model's batch
    response doesn't parse cleanly, trading speed for correctness there."""
    if not texts:
        return []

    system = BATCH_SYSTEM_PROMPT.format(locale=locale)

    if engine.provider == "anthropic":
        raw = _anthropic_call(engine, system, json.dumps(texts, ensure_ascii=False))
        translations = _parse_json_array(raw, expected_len=len(texts))
        if translations is not None:
            return translations
        # Empty/unparseable batch reply falls back to translate_text per
        # item, which has its own empty-response retry-and-raise built in.
        return [translate_text(engine, locale, t) for t in texts]

    raise SystemExit(
        f"llm_client.py has no implementation for provider '{engine.provider}' yet — "
        "add one here before naming it in translation-config.yaml."
    )
