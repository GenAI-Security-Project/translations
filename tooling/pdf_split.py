"""Split a PDF into one Markdown file per top-level section, plus one SVG
"figure" per embedded image that turns out to carry translatable text (see
image_svg.py for the OCR/blank/overlay mechanism).

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

import io
import re
from collections import Counter
from pathlib import Path
from typing import List, Optional, Tuple

import pdfplumber

import image_svg
from source_manifest import write_manifest
from text_quality import is_footer_url_artifact, is_garbled, is_page_number_artifact

LARGE_RATIO = 1.8    # candidate "meaningfully bigger than body text" floor
H1_SHRINK_TOLERANCE = 0.75  # a heading can be shrunk to 75% of the dominant heading size and still count
H2_RATIO = 1.3
IMAGE_RASTER_RESOLUTION = 200


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


def _line_events(pdf: "pdfplumber.PDF") -> List[Tuple[int, float, str, float]]:
    """[(page_index, top, text, max_word_size), ...] for every visual line, in document order."""
    out = []
    for page_index, page in enumerate(pdf.pages):
        words = page.extract_words(extra_attrs=["size"])
        grouped = {}
        for w in words:
            key = round(w["top"], 1)
            grouped.setdefault(key, []).append(w)
        for top in sorted(grouped):
            ws = grouped[top]
            text = " ".join(w["text"] for w in ws)
            out.append((page_index, top, text, max(round(w["size"], 1) for w in ws)))
    return out


def _image_events(pdf: "pdfplumber.PDF") -> List[Tuple[int, float, bytes]]:
    """[(page_index, top, png_bytes), ...] for every embedded image, rasterized
    at a fixed resolution so image_svg's OCR has enough pixels to work with."""
    out = []
    for page_index, page in enumerate(pdf.pages):
        for img in page.images:
            bbox = (
                max(img["x0"], 0), max(img["top"], 0),
                min(img["x1"], page.width), min(img["bottom"], page.height),
            )
            if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                continue
            try:
                pil_image = page.crop(bbox).to_image(resolution=IMAGE_RASTER_RESOLUTION).original
            except Exception:
                continue
            buf = io.BytesIO()
            pil_image.convert("RGB").save(buf, format="PNG")
            out.append((page_index, img["top"], buf.getvalue()))
    return out


def _split(pdf_path: Path) -> Tuple[List[Tuple[str, str]], List[Tuple[str, bytes]]]:
    """Returns ([(section_name, markdown_body), ...], [(section_name, image_bytes), ...]),
    walking lines and images together in true document order so each image is
    tagged with whichever section was open when it appeared."""
    with pdfplumber.open(str(pdf_path)) as pdf:
        lines = _line_events(pdf)
        images = _image_events(pdf)

    h1_min, h2_min = _thresholds([(text, size) for _, _, text, size in lines])

    def level(size: float) -> str:
        if size >= h1_min:
            return "h1"
        if size >= h2_min:
            return "h2"
        return "body"

    events = sorted(
        [(p, t, "line", text, size) for p, t, text, size in lines]
        + [(p, t, "image", blob, None) for p, t, blob in images],
        key=lambda e: (e[0], e[1]),
    )

    sections: List[Tuple[str, List[str]]] = []
    section_images: List[Tuple[str, bytes]] = []
    pending_heading: List[str] = []
    pending_level: Optional[str] = None

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

    for _, _, kind, payload, size in events:
        if kind == "image":
            flush_heading()
            if not sections:
                sections.append(("Preface", []))
            section_images.append((sections[-1][0], payload))
            continue

        text = payload
        if is_garbled(text):
            # A custom icon/symbol font whose codepoints got extracted as raw
            # punctuation instead of the text they render as (observed: a
            # bolded scenario title came out as pure symbol soup). Treat it
            # as if the line never existed rather than pass it to translation.
            continue
        if is_page_number_artifact(text) or is_footer_url_artifact(text):
            # A "Page N" or "genai.owasp.org" footer typed inline rather
            # than living in a real PDF header/footer region extraction
            # would skip. Pagination and footer branding from the English
            # source's layout are meaningless — and wrong — once reflowed
            # into a translated document with a different page count/
            # template; Process 2's render_config.json adds real page
            # numbers and footer branding for final layout.
            continue
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

    # A section name can exist purely to anchor an image encountered before
    # any heading (e.g. "Preface") with no text ever appended to it — that's
    # not a translatable section, and an empty/whitespace-only message is
    # rejected outright by a real translation call (only ever surfaced
    # in production, never in --offline mode, since that skips the call).
    text_sections = [(name, "\n\n".join(body_lines) + "\n") for name, body_lines in sections if body_lines]
    return text_sections, section_images


def split_pdf(pdf_path: Path) -> List[Tuple[str, str]]:
    """Return [(section_name, markdown_body), ...] split on detected top-level headings."""
    return _split(pdf_path)[0]


def split_into_source(pdf_path: Path, source_dir: Path) -> List[str]:
    """Write each split section as <source_dir>/<name>.md, plus a <name>.svg
    + images/<name>.png(+_original.png) per image with enough confidently-
    recognized text to be worth localizing. Returns all names written."""
    text_sections, image_candidates = _split(pdf_path)

    written = []
    for name, body in text_sections:
        (source_dir / f"{name}.md").write_text(body)
        written.append(name)

    images_dir = source_dir / "images"
    figure_counts: dict = {}
    figures_by_section: dict = {}
    for section_name, blob in image_candidates:
        figure_counts[section_name] = figure_counts.get(section_name, 0) + 1
        suffix = "" if figure_counts[section_name] == 1 else f"_{figure_counts[section_name]}"
        name_hint = f"{section_name}_Figure{suffix}"
        href = f"images/{name_hint}.png"

        try:
            figure = image_svg.convert_image(blob, name_hint, href)
        except Exception:
            continue
        if figure is None:
            continue

        images_dir.mkdir(exist_ok=True)
        (images_dir / f"{figure.name}.png").write_bytes(figure.base_png)
        (images_dir / f"{figure.name}_original.png").write_bytes(figure.original_png)
        (source_dir / f"{figure.name}.svg").write_text(figure.svg)
        written.append(figure.name)
        figures_by_section.setdefault(section_name, []).append(figure.name)

    raw_dir = source_dir / "_raw"
    raw_dir.mkdir(exist_ok=True)
    pdf_path.rename(raw_dir / pdf_path.name)

    # `written`'s order (all text, then all figures) is fine for translation,
    # which treats every name independently -- but render.sh wants a figure
    # to appear where it actually sat in the document, right after the
    # section it was found in, not dumped at the very end of the PDF.
    manifest_order = []
    text_section_names = {name for name, _ in text_sections}
    # A section that anchored only an image and no text (a "Preface" opened
    # purely by a cover image before the first real heading exists) never
    # made it into text_sections -- filtered out as having no body -- but
    # its figure is still a real file. It can only precede every real
    # section (the auto-"Preface" only ever gets created before the first
    # heading is found), so flush any such orphans first, in encounter order.
    for orphan_section in list(figures_by_section):
        if orphan_section not in text_section_names:
            manifest_order.extend(figures_by_section.pop(orphan_section))
    for name, _ in text_sections:
        manifest_order.append(name)
        manifest_order.extend(figures_by_section.pop(name, []))
    write_manifest(source_dir, manifest_order)
    return written
