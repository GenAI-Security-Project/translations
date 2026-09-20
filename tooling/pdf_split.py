"""Split a PDF into one Markdown file per top-level section.

Real asset uploads observed in practice are finished PDFs (e.g. an OWASP
Top-10-style document), not the Heading-1-styled .docx the Build Spec
originally assumed. This module detects heading levels the same way a human
skimming the PDF would — by relative font size, not by matching this
document's specific wording — so it generalizes across assets/templates
without per-asset special-casing (see NFR1).

Heuristic: the most common line size in the document is "body text". Among
lines meaningfully larger than body text (>=1.8x), the most common size is
the "heading" tier — a title-page cover line, or a long heading whose text
got auto-shrunk by the source layout tool to fit its box (observed in
practice: "ASI06: Memory & Context Poisoning" rendered at 24pt against every
other top-level heading's 30pt, because it's the longest title in the doc),
still counts as a top-level heading as long as it's within 25% of that
dominant size. Anything smaller than that but still >=1.3x body is a
subheading, folded into the current section as a `##` line rather than
starting a new one. Table-of-contents entries are typically set in a font
only slightly larger than body text and land in the subheading tier, so a
ToC page becomes a slightly noisy section rather than phantom top-level
sections — verified against the OWASP Agentic Top 10 PDF, where body=10.1pt,
real headings cluster at 30pt (one outlier at 24pt) bold, subsection labels
=15.1pt, and ToC entries=13.9pt in a different, non-bold font.
"""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path
from typing import List, Tuple

import pdfplumber

LARGE_RATIO = 1.8    # candidate "meaningfully bigger than body text" floor
H1_SHRINK_TOLERANCE = 0.75  # a heading can be shrunk to 75% of the dominant heading size and still count
H2_RATIO = 1.3


def _slugify(heading: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", heading).strip("_")
    return slug or "Section"


def _thresholds(lines: List[Tuple[str, float]]) -> Tuple[float, float]:
    """Return (h1_min, h2_min) line-max-size thresholds, derived from this document's
    own size distribution rather than fixed absolute points."""
    line_sizes = Counter(size for _, size in lines)
    body_size = line_sizes.most_common(1)[0][0] if line_sizes else 10.0

    large_sizes = Counter({s: n for s, n in line_sizes.items() if s >= body_size * LARGE_RATIO})
    if large_sizes:
        dominant_heading_size = large_sizes.most_common(1)[0][0]
        h1_min = dominant_heading_size * H1_SHRINK_TOLERANCE
    else:
        h1_min = body_size * LARGE_RATIO  # no clear heading tier found; fall back to the floor itself

    return h1_min, body_size * H2_RATIO


def _lines(pdf: "pdfplumber.PDF") -> List[Tuple[str, float]]:
    """[(text, max_word_size), ...] for every visual line in the document, in order."""
    out = []
    for page in pdf.pages:
        words = page.extract_words(extra_attrs=["size"])
        grouped = {}
        for w in words:
            key = round(w["top"], 1)
            grouped.setdefault(key, []).append(w)
        for top in sorted(grouped):
            ws = grouped[top]
            text = " ".join(w["text"] for w in ws)
            out.append((text, max(round(w["size"], 1) for w in ws)))
    return out


def split_pdf(pdf_path: Path) -> List[Tuple[str, str]]:
    """Return [(section_name, markdown_body), ...] split on detected top-level headings."""
    with pdfplumber.open(str(pdf_path)) as pdf:
        lines = _lines(pdf)

    h1_min, h2_min = _thresholds(lines)

    def level(size: float) -> str:
        if size >= h1_min:
            return "h1"
        if size >= h2_min:
            return "h2"
        return "body"

    sections: List[Tuple[str, List[str]]] = []
    pending_heading: List[str] = []
    pending_level: str | None = None

    def flush_heading():
        nonlocal pending_heading, pending_level
        if not pending_heading:
            return
        text = " ".join(pending_heading)
        if pending_level == "h1":
            sections.append((_slugify(text), [f"# {text}"]))
        else:
            if not sections:
                sections.append(("Preface", []))
            sections[-1][1].append(f"## {text}")
        pending_heading, pending_level = [], None

    for text, size in lines:
        lvl = level(size)
        if lvl in ("h1", "h2"):
            if pending_level == lvl:
                pending_heading.append(text)  # same heading, wrapped onto another line
            else:
                flush_heading()
                pending_heading, pending_level = [text], lvl
        else:
            flush_heading()
            if not sections:
                sections.append(("Preface", []))
            sections[-1][1].append(text)
    flush_heading()

    return [(name, "\n\n".join(lines) + "\n") for name, lines in sections]


def split_into_source(pdf_path: Path, source_dir: Path) -> List[str]:
    """Write each split section as <source_dir>/<name>.md; return the names written."""
    written = []
    for name, body in split_pdf(pdf_path):
        (source_dir / f"{name}.md").write_text(body)
        written.append(name)

    raw_dir = source_dir / "_raw"
    raw_dir.mkdir(exist_ok=True)
    pdf_path.rename(raw_dir / pdf_path.name)
    return written
