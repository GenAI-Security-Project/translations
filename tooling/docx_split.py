"""Split a Heading-1-structured .docx into one Markdown file per section,
plus one SVG "figure" per embedded image that turns out to carry translatable
text (see image_svg.py for the OCR/blank/overlay mechanism).

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

import image_svg


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


_VML_IMAGEDATA = "{urn:schemas-microsoft-com:vml}imagedata"  # legacy VML images; not in python-docx's default nsmap


def _image_blobs_in(doc: Document, p_element) -> List[bytes]:
    """Any images embedded directly in this paragraph, as raw bytes."""
    rids = [blip.get(qn("r:embed")) for blip in p_element.iter(qn("a:blip"))]
    rids += [img.get(qn("r:id")) for img in p_element.iter(_VML_IMAGEDATA)]
    blobs = []
    for rid in rids:
        if not rid:
            continue
        part = doc.part.related_parts.get(rid)
        if part is not None and part.blob:
            blobs.append(part.blob)
    return blobs


def _split(doc: Document) -> Tuple[List[Tuple[str, str]], List[Tuple[str, bytes]]]:
    """Returns ([(section_name, markdown_body), ...], [(section_name, image_bytes), ...])
    with images in document order, tagged with whichever section was open
    when they were encountered."""
    sections: List[Tuple[str, List[str]]] = []
    images: List[Tuple[str, bytes]] = []

    for para in _iter_all_paragraphs(doc):
        for blob in _image_blobs_in(doc, para._p):
            if not sections:
                sections.append(("Preface", []))
            images.append((sections[-1][0], blob))

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

    text_sections = [(name, "\n\n".join(lines) + "\n") for name, lines in sections]
    return text_sections, images


def split_docx(docx_path: Path) -> List[Tuple[str, str]]:
    """Return [(section_name, markdown_body), ...] split on Heading 1 styles."""
    return _split(Document(str(docx_path)))[0]


def split_into_source(docx_path: Path, source_dir: Path) -> List[str]:
    """Write each split section as <source_dir>/<name>.md, plus a <name>.svg
    + images/<name>.png(+_original.png) per image with enough confidently-
    recognized text to be worth localizing. Returns all names written
    (sections and figures alike — translate_section.py treats both as
    sections to draft)."""
    doc = Document(str(docx_path))
    text_sections, image_candidates = _split(doc)

    written = []
    for name, body in text_sections:
        (source_dir / f"{name}.md").write_text(body)
        written.append(name)

    images_dir = source_dir / "images"
    figure_counts: dict = {}
    for section_name, blob in image_candidates:
        figure_counts[section_name] = figure_counts.get(section_name, 0) + 1
        suffix = "" if figure_counts[section_name] == 1 else f"_{figure_counts[section_name]}"
        name_hint = f"{section_name}_Figure{suffix}"
        href = f"images/{name_hint}.png"

        try:
            figure = image_svg.convert_image(blob, name_hint, href)
        except Exception:
            continue  # a malformed/unsupported embedded image is not fatal to the rest of the split
        if figure is None:
            continue

        images_dir.mkdir(exist_ok=True)
        (images_dir / f"{figure.name}.png").write_bytes(figure.base_png)
        (images_dir / f"{figure.name}_original.png").write_bytes(figure.original_png)
        (source_dir / f"{figure.name}.svg").write_text(figure.svg)
        written.append(figure.name)

    raw_dir = source_dir / "_raw"
    raw_dir.mkdir(exist_ok=True)
    docx_path.rename(raw_dir / docx_path.name)
    return written
