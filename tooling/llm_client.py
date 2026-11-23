"""Thin translation-call wrapper so translate_section.py doesn't care which
provider is configured. Implemented providers: anthropic, google (Gemini).
To add one, write a `_<provider>_call(engine, system, user_content,
json_output)` returning (text, Usage) and register it in _PROVIDERS.
"""
from __future__ import annotations

import json
import os
import random
import re
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

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

# Gemini's free tier rate-limits per project, and Google publishes no
# per-model numbers (they're only visible in AI Studio). A 429 / 503 is
# therefore an expected, transient condition here, not a failure: back off
# and retry rather than failing the whole locale run.
RATE_LIMIT_RETRIES = 6        # per model, when there's no fallback left
RETRIES_BEFORE_FALLBACK = 2   # per model, while a fallback model remains
RATE_LIMIT_BASE_DELAY_S = 10.0
RATE_LIMIT_MAX_DELAY_S = 120.0
# Hard cap on one Gemini request. Without it a stalled connection hangs the
# job until Google drops it -- observed live: ~17 minutes, then "Server
# disconnected without sending a response". A long section normally takes
# well under this.
GEMINI_REQUEST_TIMEOUT_S = 300


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    # The model that actually answered (a fallback model, if the configured
    # one was unavailable). None for offline stubs / no call made.
    model: Optional[str] = None

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(
            self.input_tokens + other.input_tokens,
            self.output_tokens + other.output_tokens,
            other.model or self.model,
        )


def _anthropic_call(engine: Engine, system: str, user_content: str, json_output: bool = False) -> Tuple[str, Usage]:
    """One call, returning joined text blocks (which may legitimately be
    empty, e.g. a refusal) and real token usage — callers decide whether to
    retry or raise on empty text."""
    import anthropic

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=engine.model,
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    text = "".join(block.text for block in response.content if block.type == "text")
    usage = Usage(input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens, model=engine.model)
    return text, usage


def _google_call(engine: Engine, system: str, user_content: str, json_output: bool = False) -> Tuple[str, Usage]:
    """Gemini via the google-genai SDK. The client reads the key from
    GEMINI_API_KEY (or GOOGLE_API_KEY, which wins if both are set).
    json_output asks Gemini for a bare JSON response (used by
    translate_batch), which it honours far more reliably than a prompt-only
    instruction. Thinking tokens are billed as output, so they're counted
    as output here too."""
    import httpx
    from google import genai
    from google.genai import errors, types

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        raise SystemExit(
            "translation-config.yaml names provider 'google' but GEMINI_API_KEY is not set "
            "(in Actions: add the GEMINI_API_KEY repo secret). Use --offline to test without it."
        )
    client = genai.Client(http_options=types.HttpOptions(timeout=GEMINI_REQUEST_TIMEOUT_S * 1000))
    config = types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=16384,
        response_mime_type="application/json" if json_output else None,
    )
    # Free-tier models go "high demand" (503) for long stretches -- observed
    # live: gemini-3.8-flash refused 7 attempts over 8 minutes while
    # gemini-3.6-flash and gemini-3.5-flash-lite answered. So retry each
    # model briefly, then move down the configured fallback chain.
    models = [engine.model, *engine.fallback_models]
    response, used_model = None, None
    for m_index, model in enumerate(models):
        last_model = m_index == len(models) - 1
        retries = RATE_LIMIT_RETRIES if last_model else RETRIES_BEFORE_FALLBACK
        for attempt in range(retries + 1):
            try:
                response = client.models.generate_content(model=model, contents=user_content, config=config)
                used_model = model
                break
            except (errors.APIError, httpx.TransportError) as e:
                # Retryable: rate limit (429), overloaded/internal (503/500),
                # and transport failures -- timeouts and dropped connections,
                # which arrive as raw httpx errors, not APIError.
                if isinstance(e, errors.APIError):
                    retryable = e.code in (429, 500, 503)
                    reason = f"HTTP {e.code} ({e.status})"
                else:
                    retryable = True
                    reason = f"{type(e).__name__}: {e}"
                if not retryable:
                    raise
                if attempt == retries:
                    if last_model:
                        raise
                    print(f"gemini: {model} still unavailable ({reason}); "
                          f"falling back to {models[m_index + 1]}", flush=True)
                    break
                delay = min(RATE_LIMIT_MAX_DELAY_S, RATE_LIMIT_BASE_DELAY_S * 2 ** attempt)
                delay *= 0.75 + random.random() / 2  # jitter
                print(f"gemini: {model} {reason}; retrying in {delay:.0f}s "
                      f"[{attempt + 1}/{retries}]", flush=True)
                time.sleep(delay)
        if response is not None:
            break
    text = response.text or ""
    meta = response.usage_metadata
    usage = Usage(
        input_tokens=(meta.prompt_token_count or 0) if meta else 0,
        output_tokens=((meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0)) if meta else 0,
        model=used_model,
    )
    return text, usage


_PROVIDERS = {
    "anthropic": _anthropic_call,
    "google": _google_call,
}


def _provider_call(engine: Engine):
    call = _PROVIDERS.get(engine.provider)
    if call is None:
        raise SystemExit(
            f"llm_client.py has no implementation for provider '{engine.provider}' yet — "
            f"implemented: {', '.join(sorted(_PROVIDERS))}. Add one here before naming it "
            "in translation-config.yaml."
        )
    return call


def translate_text(
    engine: Engine, locale: str, source_text: str, context: str = "", offline: bool = False
) -> Tuple[str, Usage]:
    if offline:
        return f"<!-- offline stub translation for {locale} -->\n\n{source_text}", Usage()

    system = SYSTEM_PROMPT.format(locale=locale)
    if context:
        system += f"\n\nGlossary / already-translated sibling sections for consistency:\n{context}"

    call = _provider_call(engine)
    # A real (rare, observed in practice) failure mode: the API call
    # succeeds — no exception, no error status — but the model returns
    # no text content at all for a specific section. That's silently
    # indistinguishable from a real empty translation unless it's
    # checked for explicitly; left unchecked it produces a section that
    # looks drafted (a status.json entry, a committed file) but is
    # actually blank, which only surfaces on a human noticing the file
    # itself is empty in review — as happened here. Retry a couple of
    # times before giving up loudly. Applies to every provider.
    usage_so_far = Usage()
    for attempt in range(MAX_EMPTY_RETRIES + 1):
        result, usage = call(engine, system, source_text)
        usage_so_far += usage
        if result.strip():
            return result, usage_so_far
    raise RuntimeError(
        f"translate_text: model returned empty content for {locale} after "
        f"{MAX_EMPTY_RETRIES + 1} attempts (source: {len(source_text)} chars) — "
        "not writing a blank section"
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


def translate_batch(engine: Engine, locale: str, texts: List[str]) -> Tuple[List[str], Usage]:
    """Translate many short strings (a figure's text labels) in one call
    instead of one call each — each API round-trip has a fixed latency cost
    regardless of how little text it carries, so a diagram with dozens of
    short labels was paying that cost dozens of times for a handful of
    words. Falls back to one-call-per-item only if the model's batch
    response doesn't parse cleanly, trading speed for correctness there."""
    if not texts:
        return [], Usage()

    system = BATCH_SYSTEM_PROMPT.format(locale=locale)

    call = _provider_call(engine)
    raw, usage = call(engine, system, json.dumps(texts, ensure_ascii=False), json_output=True)
    translations = _parse_json_array(raw, expected_len=len(texts))
    if translations is not None:
        return translations, usage

    # Empty/unparseable batch reply falls back to translate_text per
    # item, which has its own empty-response retry-and-raise built in.
    results = []
    total_usage = usage
    for t in texts:
        result, item_usage = translate_text(engine, locale, t)
        results.append(result)
        total_usage += item_usage
    return results, total_usage
