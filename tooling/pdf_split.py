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

Body text lines are joined back into real paragraphs, not kept one-per-line:
pdfplumber hands back every visual line of the source PDF's own layout
separately, and treating each of those as its own Markdown paragraph
(blank-line-separated) produced a real bug caught in review -- roughly
three-quarters of a real document's paragraph-like blocks were mid-sentence
fragments, each getting its own paragraph margin when rendered, visibly
choppy spacing throughout. See _typical_body_line_gap and the
paragraph-continuation check in _split for how a wrapped line is told apart
from a genuine new paragraph, using the document's own line-spacing rather
than a fixed constant.
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
# Extra same-page vertical gap, on top of the document's own typical
# body-line spacing (see _typical_body_line_gap), that marks a real
# paragraph break rather than the source PDF's own mid-sentence line wrap.
# An additive margin rather than a multiplicative ratio on that typical gap,
# since the typical gap can legitimately come out small or slightly negative
# (font descenders/ascenders overlapping adjacent lines' bounding boxes) --
# a ratio on a near-zero or negative baseline doesn't scale sensibly.
PARAGRAPH_BREAK_EXTRA = 0.6  # multiplied by body_size below
_SENTENCE_END_RE = re.compile(r"[.:!?»\"')’]\s*$")  # ., :, !, ?, », ", ', ), '
# A numbered/bulleted list item in this document's own source layout often
# has no more vertical space before it than an ordinary mid-sentence line
# wrap does -- the gap-based check above can't tell "1. Foo" from a wrapped
# continuation of the previous line by spacing alone. Its own leading marker
# is the real signal: it always starts a new block, wrap gap or not.
_LIST_ITEM_RE = re.compile(r"^(\d{1,3}[.)]|[•●\-*])\s")


def _slugify(heading: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", heading).strip("_")
    return slug or "Section"


def _thresholds(lines: List[Tuple[str, float]]) -> Tuple[float, float, float]:
    """Return (h1_min, h2_min, body_size) line-max-size thresholds, derived from
    this document's own size distribution rather than fixed absolute points."""
    line_sizes = Counter(size for _, size in lines)
    body_size = line_sizes.most_common(1)[0][0] if line_sizes else 10.0

    large_sizes = Counter({s: n for s, n in line_sizes.items() if s >= body_size * LARGE_RATIO})
    if large_sizes:
        dominant_heading_size = large_sizes.most_common(1)[0][0]
        h1_min = dominant_heading_size * H1_SHRINK_TOLERANCE
    else:
        h1_min = body_size * LARGE_RATIO  # no clear heading tier found; fall back to the floor itself

    return h1_min, body_size * H2_RATIO, body_size


def _line_events(pdf: "pdfplumber.PDF") -> List[Tuple[int, float, float, str, float]]:
    """[(page_index, top, bottom, text, max_word_size), ...] for every visual
    line, in document order. `bottom` (added alongside the pre-existing `top`)
    is what lets _typical_body_line_gap and the paragraph-continuation check
    in _split measure the actual vertical gap between consecutive lines."""
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
            bottom = max(w["bottom"] for w in ws)
            out.append((page_index, top, bottom, text, max(round(w["size"], 1) for w in ws)))
    return out


def _typical_body_line_gap(lines: List[Tuple[int, float, float, str, float]], h2_min: float) -> float:
    """The document's own most common same-page top-to-bottom gap between
    two consecutive body-sized lines -- ordinary single-line spacing within
    a paragraph, as this specific PDF actually laid it out (font, leading,
    and pdfplumber's own bbox measurement all vary enough between documents
    that a fixed point value would be wrong as often as right). A gap much
    bigger than this (see PARAGRAPH_BREAK_EXTRA in _split) means a real
    paragraph break, not just where the source happened to wrap a sentence."""
    gaps = []
    for (p1, _, bottom1, _, s1), (p2, top2, _, _, s2) in zip(lines, lines[1:]):
        if p1 == p2 and s1 < h2_min and s2 < h2_min:
            gaps.append(round(top2 - bottom1, 1))
    return Counter(gaps).most_common(1)[0][0] if gaps else 0.0


# How close a vector shape (rect/line/curve) has to sit to the growing crop
# box to count as part of the same figure -- see _expand_to_connected_shapes.
# Tuned against a real document: the figure's own shapes sit 0-tens of pts
# apart (touching or nearly so), while genuinely unrelated page content
# measured 37-57pt away on the one real page checked. 12pt sits well inside
# that gap -- comfortably bridges real adjacent diagram elements without
# reaching across to unrelated content elsewhere on the page.
SHAPE_PROXIMITY_PT = 12.0
# After expansion, two embedded images that both belong to the same
# vector-drawn figure (e.g. a couple of small icons inside one diagram, as
# opposed to two genuinely separate figures on the same page) converge on
# the same -- or near-identical -- expanded box. If a newly expanded box's
# own area is this much contained within one already emitted for the page,
# it's treated as the same figure and skipped rather than emitted twice.
DUPLICATE_CONTAINMENT_RATIO = 0.8
# A separate, stricter bar than image_svg.MIN_CLUSTERS_TO_CONVERT (3) for
# deciding whether an embedded image's RAW crop looks enough like a real
# figure to expand its bounds -- see _image_events' own docstring for the
# real case this is calibrated against: a plain decorative image's crop
# that happened to catch the first row of an unrelated table sitting close
# by read as exactly 3 clusters (a few real words bleeding in from that
# table, not an OCR hallucination), while a real diagram's own raw crop,
# checked on an actual document, came back with 11. 5 sits well clear of
# both, on the side that treats "barely clears the bar" as more likely
# bleed-through than a genuine figure.
MIN_CLUSTERS_TO_EXPAND = 5


def _expand_to_connected_shapes(page: "pdfplumber.page.Page", bbox: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
    """Grow bbox to the union of every vector-drawn rect/line/curve that
    touches it (directly, or transitively through another shape already
    absorbed), stopping only once nothing more is within SHAPE_PROXIMITY_PT.

    Real-world cause this exists for: a figure built mostly from vector-
    drawn shapes (box outlines, arrows, pill-shaped headers) around one or
    more small embedded raster images (icons, a textured panel) was
    getting cropped to just the smallest embedded image's own narrow
    bounds, truncating most of the actual figure -- observed in practice
    on a real document: a diagram's true extent was roughly square, but
    the embedded-image-only crop came out short and wide, missing the
    entire top row and everything below the one raster panel it happened
    to key off of. Vector shapes (page.rects/.lines/.curves) have no
    raster representation on their own, so page.images alone can never
    see them -- this is what actually pulls them into the crop."""
    shapes = list(page.rects) + list(page.lines) + list(page.curves)
    x0, top, x1, bottom = bbox
    changed = True
    while changed:
        changed = False
        for s in shapes:
            sx0, stop, sx1, sbottom = s["x0"], s["top"], s["x1"], s["bottom"]
            if (sx1 < x0 - SHAPE_PROXIMITY_PT or sx0 > x1 + SHAPE_PROXIMITY_PT
                    or sbottom < top - SHAPE_PROXIMITY_PT or stop > bottom + SHAPE_PROXIMITY_PT):
                continue
            nx0, ntop, nx1, nbottom = min(x0, sx0), min(top, stop), max(x1, sx1), max(bottom, sbottom)
            if (nx0, ntop, nx1, nbottom) != (x0, top, x1, bottom):
                x0, top, x1, bottom = nx0, ntop, nx1, nbottom
                changed = True
    return (x0, top, x1, bottom)


def _containment_ratio(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]) -> float:
    """Fraction of a's own area that overlaps b."""
    ax0, atop, ax1, abottom = a
    bx0, btop, bx1, bbottom = b
    ix0, itop = max(ax0, bx0), max(atop, btop)
    ix1, ibottom = min(ax1, bx1), min(abottom, bbottom)
    if ix1 <= ix0 or ibottom <= itop:
        return 0.0
    area_a = (ax1 - ax0) * (abottom - atop)
    if area_a <= 0:
        return 0.0
    return ((ix1 - ix0) * (ibottom - itop)) / area_a


def _image_events(pdf: "pdfplumber.PDF") -> List[Tuple[int, float, bytes]]:
    """[(page_index, top, png_bytes), ...] for every embedded image, rasterized
    at a fixed resolution so image_svg's OCR has enough pixels to work with.
    An image whose own raw crop already shows MIN_CLUSTERS_TO_EXPAND or
    more confidently-recognized text clusters has its bounds first grown
    to absorb any vector-drawn shape connected to it (see
    _expand_to_connected_shapes) -- a figure is often a mix of vector
    graphics and one or more small embedded rasters, and page.images alone
    only ever sees the latter, so a figure built mostly from vector shapes
    around one small raster was getting cropped to just that raster's own
    narrow bounds, truncating most of the actual figure.

    That gate, checked against the RAW crop before any expansion, isn't
    optional: a purely decorative element repeated on every page (a corner
    logo, a background band) sits on the SAME page as, and can be
    geometrically close enough to chain into, completely unrelated
    vector-drawn content -- a data table's own cell borders, say.
    Expanding every embedded image indiscriminately was checked against a
    real multi-page document and found to inflate a plain decorative image
    up to ~80% of the page's own area on pages that happened to also hold
    a large table, which is exactly the kind of bug this is trying to fix,
    just relocated rather than removed: besides being pure waste,
    downstream OCR over the absorbed table text would likely still pass
    image_svg's own conversion bar and get written out as a second,
    non-editable, untranslatable copy of content the text extraction above
    already captured correctly as real paragraphs. A plain
    MIN_CLUSTERS_TO_CONVERT check turned out not to be a strict enough
    gate on its own, either -- a decorative crop that happens to catch a
    table's own first row sitting close by can clear that same bar on a
    few real (not hallucinated) bleed-through words; MIN_CLUSTERS_TO_EXPAND
    sits higher, clear of that case on a real document while a genuine
    figure's own raw cluster count sat well above it. Both are
    content-driven checks, not a size or page-position rule, so this holds
    for any future document regardless of that document's own page layout
    or image dimensions."""
    out = []
    for page_index, page in enumerate(pdf.pages):
        emitted_boxes: List[Tuple[float, float, float, float]] = []
        for img in page.images:
            raw_bbox = (
                max(img["x0"], 0), max(img["top"], 0),
                min(img["x1"], page.width), min(img["bottom"], page.height),
            )
            if raw_bbox[2] <= raw_bbox[0] or raw_bbox[3] <= raw_bbox[1]:
                continue
            bbox = raw_bbox
            try:
                raw_pil_image = page.crop(raw_bbox).to_image(resolution=IMAGE_RASTER_RESOLUTION).original.convert("RGB")
            except Exception:
                continue
            if image_svg.confident_cluster_count(raw_pil_image) >= MIN_CLUSTERS_TO_EXPAND:
                expanded = _expand_to_connected_shapes(page, raw_bbox)
                bbox = (
                    max(expanded[0], 0), max(expanded[1], 0),
                    min(expanded[2], page.width), min(expanded[3], page.height),
                )
            if any(_containment_ratio(bbox, seen) >= DUPLICATE_CONTAINMENT_RATIO for seen in emitted_boxes):
                continue  # same figure as one already emitted for this page -- a second small icon inside it, say
            emitted_boxes.append(bbox)
            if bbox is raw_bbox:
                pil_image = raw_pil_image
            else:
                try:
                    pil_image = page.crop(bbox).to_image(resolution=IMAGE_RASTER_RESOLUTION).original.convert("RGB")
                except Exception:
                    continue
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            out.append((page_index, bbox[1], buf.getvalue()))
    return out


def _split(pdf_path: Path) -> Tuple[List[Tuple[str, str]], List[Tuple[str, bytes]]]:
    """Returns ([(section_name, markdown_body), ...], [(section_name, image_bytes), ...]),
    walking lines and images together in true document order so each image is
    tagged with whichever section was open when it appeared."""
    with pdfplumber.open(str(pdf_path)) as pdf:
        lines = _line_events(pdf)
        images = _image_events(pdf)

    h1_min, h2_min, body_size = _thresholds([(text, size) for _, _, _, text, size in lines])
    paragraph_break_gap = _typical_body_line_gap(lines, h2_min) + body_size * PARAGRAPH_BREAK_EXTRA

    def level(size: float) -> str:
        if size >= h1_min:
            return "h1"
        if size >= h2_min:
            return "h2"
        return "body"

    events = sorted(
        [(p, t, "line", text, size, bottom) for p, t, bottom, text, size in lines]
        + [(p, t, "image", blob, None, None) for p, t, blob in images],
        key=lambda e: (e[0], e[1]),
    )

    sections: List[Tuple[str, List[str]]] = []
    section_images: List[Tuple[str, bytes]] = []
    pending_heading: List[str] = []
    pending_level: Optional[str] = None
    # (page_index, bottom) of the last body line appended -- None whenever a
    # heading or image was the most recent thing seen, since text can never
    # continue a paragraph across one of those. Drives the paragraph-
    # continuation check below (see _typical_body_line_gap's docstring).
    prev_body_end: Optional[Tuple[int, float]] = None

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

    for page_index, top, kind, payload, size, bottom in events:
        if kind == "image":
            flush_heading()
            if not sections:
                sections.append(("Preface", []))
            section_images.append((sections[-1][0], payload))
            prev_body_end = None
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
            prev_body_end = None  # a heading always ends any paragraph in progress
        else:
            flush_heading()
            if not sections:
                sections.append(("Preface", []))
            body_lines = sections[-1][1]

            # Is this line really a new paragraph, or just where the source
            # PDF's own layout happened to wrap a sentence onto the next
            # line? Same page: compare the vertical gap against this
            # document's own typical single-line spacing (paragraph_break_gap
            # -- see _typical_body_line_gap). Different page: no shared
            # geometry to compare, so fall back to a text-only signal --
            # a previous line that doesn't end in sentence-closing
            # punctuation is almost certainly a paragraph that just happened
            # to break across a page boundary, not a new one starting
            # exactly at the top of the next page.
            if prev_body_end is None or not body_lines or _LIST_ITEM_RE.match(text):
                is_continuation = False
            elif prev_body_end[0] == page_index:
                is_continuation = (top - prev_body_end[1]) <= paragraph_break_gap
            else:
                is_continuation = not _SENTENCE_END_RE.search(body_lines[-1])

            if is_continuation:
                body_lines[-1] = f"{body_lines[-1]} {text}"
            else:
                body_lines.append(text)
            prev_body_end = (page_index, bottom)
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
