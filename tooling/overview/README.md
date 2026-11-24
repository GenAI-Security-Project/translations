# Manager overview deck and explainer video

Sources for `docs/media/GenAI-Translations-Manager-Overview.pptx` and
`docs/media/GenAI-Translations-Explainer.mp4` (+ `.vtt` captions), both
linked from the site's Docs page.

The video is the deck itself: each slide is shown for as long as its
**speaker notes** take to read aloud, with captions made from the same
notes. The narration is [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M)
(Apache-2.0, runs locally), voice **af_bella**; `make_video.py`'s
`PRONOUNCE` map fixes how a few words are said (e.g. "GenAI" → "Gen A I")
without changing the captions. To change what the video says, edit the
notes in `build_deck.js` and rebuild both.

Both show only the **"GenAI SECURITY PROJECT"** part of the logo: the
OWASP mark, the word OWASP and the divider are cropped off in memory by
`build_deck.js` (`LOGO_CROP_LEFT`, default 300 px; `0` for the full logo).
The logo file in `docs/assets/` is not edited.

## Rebuild (macOS)

Needs Node with `pptxgenjs react react-dom react-icons sharp`, Python 3.10–3.12
with `kokoro soundfile python-pptx` (and `espeak-ng` from Homebrew),
LibreOffice (`soffice`), Poppler (`pdftoppm`) and `ffmpeg`.
`apply_theme.js` comes from the pptx skill used to build the deck; without
it, drop that call and the deck keeps Office's default theme colours.

```bash
NODE_PATH=./node_modules PPTX_SKILL=<pptx skill dir> \
  node build_deck.js GenAI-Translations-Manager-Overview.pptx ../../docs/assets/owasp-genai-security-project-logo.png
soffice --headless --convert-to pdf GenAI-Translations-Manager-Overview.pptx
python make_video.py GenAI-Translations-Manager-Overview.pptx GenAI-Translations-Manager-Overview.pdf GenAI-Translations-Explainer
cp GenAI-Translations-Manager-Overview.pptx GenAI-Translations-Explainer.mp4 GenAI-Translations-Explainer.vtt ../../docs/media/
```
