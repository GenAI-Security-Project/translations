"""Tier 1 image localization: OCR out any embedded text, blank it from the
raster, and hand back an SVG that overlays the extracted text as real,
translatable <text> nodes on top of the (now text-free) base image.

This deliberately does not attempt to vectorize the underlying graphic
(Tier 2) — the diagram/photo stays exactly as designed; only the text layer
becomes swappable per locale. See tooling/README.md's "Figures" section for
the full design and its known limitations.

Because OCR confidence does not reliably track semantic correctness (a
garbled read can still score high), this is intentionally conservative:
anything not confidently and cleanly recognized is left alone in the base
image rather than risking a mistranslated hallucination of what the image
said. A human should always eyeball a figure's original image against the
generated SVG before approving it — more so than for a prose section.
"""
from __future__ import annotations

import io
import re
from collections import Counter
from dataclasses import dataclass
from typing import List, Optional, Tuple
from xml.sax.saxutils import escape

import pytesseract
from PIL import Image

WORD_CONF_MIN = 55       # bar for text we're confident enough to translate and overlay
BLANK_WORD_CONF_MIN = 20  # much looser bar for "this is text-shaped, blank it" — see blank_regions()
CLUSTER_CONF_MIN = 65
MIN_CLUSTER_TEXT_LEN = 3
MIN_IMAGE_DIMENSION = 300   # skip small icons/logos/bullets
MIN_CLUSTERS_TO_CONVERT = 3  # skip images with too little confident text (photos, logos)


@dataclass
class TextRegion:
    text: str
    left: int
    top: int
    width: int
    height: int
    avg_conf: float


def _slugify(text: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return slug or "Figure"


def _extract_word_boxes(image: Image.Image, conf_min: int) -> List[dict]:
    # PSM 11 ("sparse text"): find text wherever it is, don't assume running
    # prose — this document ships arbitrary scattered diagram labels, not a
    # page of paragraphs.
    data = pytesseract.image_to_data(image, config="--psm 11", output_type=pytesseract.Output.DICT)
    words = []
    for i in range(len(data["text"])):
        text = data["text"][i]
        conf = int(data["conf"][i])
        if not text.strip() or conf < conf_min:
            continue
        words.append({
            "text": text, "conf": conf,
            "left": data["left"][i], "top": data["top"][i],
            "width": data["width"][i], "height": data["height"][i],
        })
    return words


def _group_into_clusters(words: List[dict]) -> List[List[dict]]:
    """Group words into single-line spatial labels: first by vertical center
    (same physical line), then by horizontal gap along that line. Pure
    geometry — callers decide what to do with the resulting groups.

    Deliberately does NOT bridge separate physical lines into one group —
    tesseract's own line/paragraph grouping does that, and it's wrong here:
    a stacked title+subtitle (different font sizes) or a multi-line caption
    would get one merged bounding box, and deriving a single font size from
    that box's overall height produces wildly oversized text. Keeping each
    physical line as its own group costs a little translation context on
    multi-line captions, an accepted tradeoff for this first pass."""
    if not words:
        return []

    heights = sorted(w["height"] for w in words)
    median_h = heights[len(heights) // 2]
    line_tolerance = median_h * 0.5
    gap_tolerance = median_h * 1.5

    by_center = sorted(words, key=lambda w: w["top"] + w["height"] / 2)
    lines: List[List[dict]] = []
    for w in by_center:
        center = w["top"] + w["height"] / 2
        if lines and abs(center - lines[-1][-1]["_center"]) <= line_tolerance:
            w["_center"] = (lines[-1][-1]["_center"] * len(lines[-1]) + center) / (len(lines[-1]) + 1)
            lines[-1].append(w)
        else:
            w["_center"] = center
            lines.append([w])

    clusters = []
    for line in lines:
        line.sort(key=lambda w: w["left"])
        cluster: List[dict] = []
        for w in line:
            if cluster and w["left"] - (cluster[-1]["left"] + cluster[-1]["width"]) > gap_tolerance:
                clusters.append(cluster)
                cluster = []
            cluster.append(w)
        if cluster:
            clusters.append(cluster)
    return clusters


def _bbox_of(members: List[dict]) -> Tuple[int, int, int, int]:
    left = min(w["left"] for w in members)
    top = min(w["top"] for w in members)
    right = max(w["left"] + w["width"] for w in members)
    bottom = max(w["top"] + w["height"] for w in members)
    return left, top, right, bottom


def _overlay_regions(image: Image.Image) -> List[TextRegion]:
    """Clusters worth confidently transcribing and drawing as new text."""
    clusters = _group_into_clusters(_extract_word_boxes(image, WORD_CONF_MIN))
    regions = []
    for members in clusters:
        text = " ".join(w["text"] for w in members)
        avg_conf = sum(w["conf"] for w in members) / len(members)
        if avg_conf < CLUSTER_CONF_MIN or len(text) < MIN_CLUSTER_TEXT_LEN:
            continue
        left, top, right, bottom = _bbox_of(members)
        regions.append(TextRegion(text, left, top, right - left, bottom - top, avg_conf))
    return regions


def _blank_boxes(image: Image.Image, pad: int = 2) -> List[Tuple[int, int, int, int]]:
    """Every text-shaped region worth erasing from the raster, at a much
    looser confidence bar than _overlay_regions — a word too garbled to
    transcribe safely is still worth blanking, so its illegible fragment
    doesn't peek out from under (or beside) whatever replaces its confident
    neighbors on the same line. Better a clean gap than doubled text."""
    clusters = _group_into_clusters(_extract_word_boxes(image, BLANK_WORD_CONF_MIN))
    boxes = []
    for members in clusters:
        left, top, right, bottom = _bbox_of(members)
        boxes.append((left - pad, top - pad, right + pad, bottom + pad))
    return boxes


def _dominant_color(pixels: List[Tuple[int, int, int]]) -> Tuple[int, int, int]:
    # Bucket to reduce anti-aliasing noise before taking the mode.
    buckets = Counter((r // 8 * 8, g // 8 * 8, b // 8 * 8) for r, g, b in pixels)
    return buckets.most_common(1)[0][0]


def _sample_background(image: Image.Image, box: Tuple[int, int, int, int], ring: int = 5) -> Tuple[int, int, int]:
    left, top, right, bottom = box
    x0, y0 = max(left - ring, 0), max(top - ring, 0)
    x1, y1 = min(right + ring, image.width), min(bottom + ring, image.height)
    outer = image.crop((x0, y0, x1, y1))
    inner = (left - x0, top - y0, right - x0, bottom - y0)
    pixels = [
        outer.getpixel((x, y))
        for y in range(outer.height)
        for x in range(outer.width)
        if not (inner[0] <= x < inner[2] and inner[1] <= y < inner[3])
    ]
    return _dominant_color(pixels) if pixels else (255, 255, 255)


def _sample_text_color(image: Image.Image, box: Tuple[int, int, int, int], background: Tuple[int, int, int]) -> Tuple[int, int, int]:
    crop = image.crop(box)
    def dist(c):
        return sum((a - b) ** 2 for a, b in zip(c, background))
    threshold = 80 ** 2
    ink_pixels = [p for p in crop.getdata() if dist(p) > threshold]
    if not ink_pixels:
        luminance = sum(background) / 3
        return (0, 0, 0) if luminance > 128 else (255, 255, 255)
    return _dominant_color(ink_pixels)


def is_text_heavy(image: Image.Image) -> bool:
    if image.width < MIN_IMAGE_DIMENSION or image.height < MIN_IMAGE_DIMENSION:
        return False
    return len(_overlay_regions(image)) >= MIN_CLUSTERS_TO_CONVERT


def blank_regions(image: Image.Image, blank_boxes: List[Tuple[int, int, int, int]]) -> Image.Image:
    """Erase every loosely-detected text-shaped box — see _blank_boxes()'s
    docstring for why this uses a much looser set than what gets overlaid."""
    from PIL import ImageDraw
    out = image.copy()
    draw = ImageDraw.Draw(out)
    for box in blank_boxes:
        draw.rectangle(list(box), fill=_sample_background(image, box))
    return out


def build_overlay_svg(image: Image.Image, image_href: str, regions: List[TextRegion]) -> str:
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{image.width}" height="{image.height}" viewBox="0 0 {image.width} {image.height}">',
        f'  <!-- OCR-extracted text overlay. Verify each line against the original image '
        f'(see the sibling _original file) before trusting this as a translation source. -->',
        f'  <image href="{escape(image_href)}" xlink:href="{escape(image_href)}" '
        f'width="{image.width}" height="{image.height}"/>',
    ]
    for i, region in enumerate(regions):
        box = (region.left, region.top, region.left + region.width, region.top + region.height)
        bg = _sample_background(image, box)
        fg = _sample_text_color(image, box, bg)
        font_size = max(int(region.height * 0.85), 8)
        baseline_y = region.top + region.height - max(int(region.height * 0.15), 1)
        color = f"rgb({fg[0]},{fg[1]},{fg[2]})"
        lines.append(
            f'  <text id="t{i}" x="{region.left}" y="{baseline_y}" font-size="{font_size}" '
            f'fill="{color}" data-ocr-confidence="{region.avg_conf:.0f}">{escape(region.text)}</text>'
        )
    lines.append("</svg>")
    return "\n".join(lines) + "\n"


@dataclass
class FigureArtifact:
    name: str
    original_png: bytes
    base_png: bytes
    svg: str


def convert_image(image_bytes: bytes, name_hint: str, image_href: str) -> Optional[FigureArtifact]:
    """Return a FigureArtifact if this image has enough confidently-recognized
    text to be worth converting, else None (leave it as an ordinary image)."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if not is_text_heavy(image):
        return None

    regions = _overlay_regions(image)
    blanked = blank_regions(image, _blank_boxes(image))
    svg = build_overlay_svg(image, image_href, regions)

    original_buf, base_buf = io.BytesIO(), io.BytesIO()
    image.save(original_buf, format="PNG")
    blanked.save(base_buf, format="PNG")

    return FigureArtifact(
        name=_slugify(name_hint),
        original_png=original_buf.getvalue(),
        base_png=base_buf.getvalue(),
        svg=svg,
    )
