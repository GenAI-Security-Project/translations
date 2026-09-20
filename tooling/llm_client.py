"""Thin translation-call wrapper so translate_section.py doesn't care which
provider is configured. Add a branch here if translation-config.yaml ever
names a provider other than anthropic/openai/google.
"""
from __future__ import annotations

from translation_config import Engine

SYSTEM_PROMPT = (
    "You are translating a security-guidance document section for the OWASP "
    "GenAI Security Project from English into {locale}. Translate faithfully "
    "and completely — do not summarize, omit, or add content. Preserve "
    "Markdown structure (headings, lists, code spans, links) exactly. Keep "
    "product/vulnerability identifiers such as 'LLM01' untranslated. Match "
    "the terminology used in the glossary and prior sections below, if given."
)


def translate_text(engine: Engine, locale: str, source_text: str, context: str = "", offline: bool = False) -> str:
    if offline:
        return f"<!-- offline stub translation for {locale} -->\n\n{source_text}"

    system = SYSTEM_PROMPT.format(locale=locale)
    if context:
        system += f"\n\nGlossary / already-translated sibling sections for consistency:\n{context}"

    if engine.provider == "anthropic":
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.create(
            model=engine.model,
            max_tokens=8192,
            system=system,
            messages=[{"role": "user", "content": source_text}],
        )
        return "".join(block.text for block in response.content if block.type == "text")

    raise SystemExit(
        f"llm_client.py has no implementation for provider '{engine.provider}' yet — "
        "add one here before naming it in translation-config.yaml."
    )
