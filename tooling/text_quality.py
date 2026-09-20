"""Detect text-extraction garbage before it ever reaches a translation call.

Observed in practice: a PDF line that should have been a bolded scenario
title extracted as `!"#$%"&'()*$%+(,(-.#$%"&'(-./0'#%&#01"` — a custom icon/
symbol font whose glyph codepoints got read back as raw ASCII punctuation
rather than the text they were meant to render as. Sending that straight to
a real translation call got an empty response back three times in a row
(plausibly: nonsense symbol strings inside a section literally about
prompt injection and embedded malicious instructions read as suspicious
enough to trigger a safety response) — a failure mode --offline testing
can never catch, since it never calls a real model.

Not specific to PDFs — the same defensive check applies wherever text gets
pulled out of a source document, since any extractor can hit an analogous
font/encoding mismatch.
"""
from __future__ import annotations

MIN_ALNUM_OR_SPACE_RATIO = 0.5
MIN_LENGTH = 8  # below this, a lone bullet/arrow/dash marker ("-", "→", "•") is
                # normal PDF layout output, not extraction corruption — only a
                # sustained run of symbols indicates a broken font mapping


def is_garbled(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < MIN_LENGTH:
        return False
    clean = sum(1 for c in stripped if c.isalnum() or c.isspace())
    return (clean / len(stripped)) < MIN_ALNUM_OR_SPACE_RATIO
