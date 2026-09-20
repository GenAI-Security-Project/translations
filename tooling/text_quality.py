"""Detect text-extraction artifacts before they ever reach a translation call
or land in a committed _source/ section.

Garbled text (is_garbled): observed in practice, a PDF line that should have
been a bolded scenario title extracted as
`!"#$%"&'()*$%+(,(-.#$%"&'(-./0'#%&#01"` — a custom icon/symbol font whose
glyph codepoints got read back as raw ASCII punctuation rather than the text
they were meant to render as. Sending that straight to a real translation
call got an empty response back three times in a row (plausibly: nonsense
symbol strings inside a section literally about prompt injection and
embedded malicious instructions read as suspicious enough to trigger a
safety response) — a failure mode --offline testing can never catch, since
it never calls a real model.

Page-number artifacts (is_page_number_artifact): a standalone "Page N"
line, also observed in practice in both the real PDF and the real docx
tested against this pipeline — page numbers are typed inline as running
footer text rather than living in a real header/footer that extraction
would naturally skip. These are pagination from the *English source's*
layout, meaningless (and wrong) once translated and reflowed into a
different template/language/page count — Process 2's render_config.json
adds real page numbers for the final layout, so the source shouldn't carry
stale ones through translation.

Footer-URL artifacts (is_footer_url_artifact): the same running-footer
problem as page numbers, one line down in the real source — every page of
the real PDF/docx repeats "genai.owasp.org" as its own standalone line
directly below the page number, the site's own footer branding typed
inline rather than living in a real header/footer region. It belongs in
final layout (Process 2), not translated body content, for the same
reason a stale page number does. Scoped to that one known literal domain,
not a general bare-URL/domain regex — a broad pattern risks stripping a
legitimate reference URL that happens to sit alone on its own line (e.g.
in a References section), which a footer-branding line never is.

Neither check is specific to PDFs — both apply wherever text gets pulled
out of a source document, since any extractor (docx or pdf) can hit an
analogous artifact.
"""
from __future__ import annotations

import re

MIN_ALNUM_OR_SPACE_RATIO = 0.5
MIN_LENGTH = 8  # below this, a lone bullet/arrow/dash marker ("-", "→", "•") is
                # normal PDF layout output, not extraction corruption — only a
                # sustained run of symbols indicates a broken font mapping

_PAGE_NUMBER_RE = re.compile(r"^page\s+\d+$", re.IGNORECASE)
_FOOTER_URL_RE = re.compile(r"^(https?://)?(www\.)?genai\.owasp\.org/?$", re.IGNORECASE)


def is_garbled(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < MIN_LENGTH:
        return False
    clean = sum(1 for c in stripped if c.isalnum() or c.isspace())
    return (clean / len(stripped)) < MIN_ALNUM_OR_SPACE_RATIO


def is_page_number_artifact(text: str) -> bool:
    """Matches a standalone "Page 15"-style line, and nothing looser than
    that — a bare number alone on its line is NOT treated as a page number
    (too easy to collide with a genuine numbered-list item rendered on its
    own line), only the unambiguous "Page <N>" form actually observed."""
    return bool(_PAGE_NUMBER_RE.match(text.strip()))


def is_footer_url_artifact(text: str) -> bool:
    """Matches a standalone "genai.owasp.org" running-footer line (with or
    without a scheme/www prefix), and nothing looser — see module docstring
    for why this is scoped to the one known literal domain."""
    return bool(_FOOTER_URL_RE.match(text.strip()))
