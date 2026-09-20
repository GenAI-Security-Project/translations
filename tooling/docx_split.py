"""Split a Heading-1-structured .docx into one Markdown file per section.

Used by translate_section.py the first time an asset whose registry
`split_by` is `heading_1` is processed for a release — once per release
(operating on _source/), never once per locale.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator, List, Tuple

from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph


def _slugify(heading: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", heading).strip("_")
    return slug or "Section"


def _iter_all_paragraphs(doc: Document) -> Iterator[Paragraph]:
    """doc.paragraphs only sees direct body children — it misses paragraphs
    wrapped in <w:sdt> (structured document tags), which real-world exports
    (observed: a Google-Docs-produced .docx) use freely. Walk the full tree
    instead so every heading is found regardless of what wraps it."""
    for p_element in doc.element.body.iter(qn("w:p")):
        yield Paragraph(p_element, doc)


def split_docx(docx_path: Path) -> List[Tuple[str, str]]:
    """Return [(section_name, markdown_body), ...] split on Heading 1 styles."""
    doc = Document(str(docx_path))
    sections: List[Tuple[str, List[str]]] = []

    for para in _iter_all_paragraphs(doc):
        text = para.text.strip()
        if not text:
            continue
        style_name = para.style.name or ""
        if style_name == "Heading 1":
            sections.append((_slugify(text), [f"# {text}"]))
        elif style_name.lower().startswith(("heading", "subhead")):
            # Real-world exports use style names like "Heading 3 - No TOC" or
            # "Subhead" for sub-levels, not just a clean "Heading N" — treat
            # any of them as a subheading rather than losing the structure.
            last_token = style_name.split()[-1]
            level = "#" * min(int(last_token), 6) if last_token.isdigit() else "##"
            if not sections:
                sections.append(("Preface", []))
            sections[-1][1].append(f"{level} {text}")
        else:
            if not sections:
                sections.append(("Preface", []))
            sections[-1][1].append(text)

    return [(name, "\n\n".join(lines) + "\n") for name, lines in sections]


def split_into_source(docx_path: Path, source_dir: Path) -> List[str]:
    """Write each split section as <source_dir>/<name>.md; return the names written."""
    written = []
    for name, body in split_docx(docx_path):
        (source_dir / f"{name}.md").write_text(body)
        written.append(name)

    raw_dir = source_dir / "_raw"
    raw_dir.mkdir(exist_ok=True)
    docx_path.rename(raw_dir / docx_path.name)
    return written
