"""Split a Heading-1-structured .docx into one Markdown file per section.

Used by translate_section.py the first time an asset whose registry
`split_by` is `heading_1` is processed for a release — once per release
(operating on _source/), never once per locale.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import List, Tuple

from docx import Document


def _slugify(heading: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", heading).strip("_")
    return slug or "Section"


def split_docx(docx_path: Path) -> List[Tuple[str, str]]:
    """Return [(section_name, markdown_body), ...] split on Heading 1 styles."""
    doc = Document(str(docx_path))
    sections: List[Tuple[str, List[str]]] = []

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        if para.style.name == "Heading 1":
            sections.append((_slugify(text), [f"# {text}"]))
        elif para.style.name and para.style.name.startswith("Heading"):
            level = "#" * min(int(para.style.name.split()[-1] or 2), 6) if para.style.name.split()[-1].isdigit() else "##"
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
