// The locale catalog, grouped by script-handling category — matches
// translations-templates/'s actual directory layout as enumerated in the
// Build Spec's own "translations-templates repo layout" section.
//
// Note: the PRD's summary prose says "19 locales" in three places, but its
// own Build Spec enumerates 22 (this list). That's a real inconsistency in
// the source documents, not something introduced here — using the actual
// enumerated list since it's the concrete, actionable data; flagged in the
// PRD's own "Open questions" as "Locale catalog closure" for someone to
// resolve.
//
// `needsOverride: true` means this script category needs a render_config.json
// override in translations-templates before Process 2 can publish it — none
// exist there yet (that repo currently only has default/ configs), so every
// locale in a needs-override category will show the readiness warning until
// an admin adds one. `needsOverride: false` locales use the default config.
const LOCALE_CATALOG = [
  // Western European Latin — low risk, standard font
  { code: "de-DE", name: "German", category: "Western European Latin", needsOverride: true, note: "hyphenation for long compounds" },
  { code: "es-ES", name: "Spanish", category: "Western European Latin", needsOverride: false },
  { code: "pt-BR", name: "Portuguese (Brazil)", category: "Western European Latin", needsOverride: false },
  { code: "fr-FR", name: "French", category: "Western European Latin", needsOverride: false },
  { code: "sv-SE", name: "Swedish", category: "Western European Latin", needsOverride: false },
  { code: "nl-NL", name: "Dutch", category: "Western European Latin", needsOverride: false },
  // CJK / Korean — line-breaking (kinsoku shori) or Hangul syllable blocks
  { code: "zh-TW", name: "Chinese (Traditional)", category: "CJK", needsOverride: true },
  { code: "ja-JP", name: "Japanese", category: "CJK", needsOverride: true },
  { code: "zh-CN", name: "Chinese (Simplified)", category: "CJK", needsOverride: true },
  { code: "ko-KR", name: "Korean", category: "Korean", needsOverride: true, note: "lower risk than CJK — spaces words" },
  // Greek — monotonic, single accent, standard font
  { code: "el-GR", name: "Greek", category: "Greek", needsOverride: false },
  // Cyrillic
  { code: "ru-RU", name: "Russian", category: "Cyrillic", needsOverride: true },
  { code: "uk-UA", name: "Ukrainian", category: "Cyrillic", needsOverride: true, note: "needs full glyph set, not a Russian-only subset" },
  // Vietnamese — stacked tone-mark diacritics
  { code: "vi-VN", name: "Vietnamese", category: "Vietnamese", needsOverride: true },
  // Complex-shaping (real OpenType GSUB/GPOS: conjuncts, vowel reordering)
  { code: "hi-IN", name: "Hindi", category: "Complex-shaping", needsOverride: true },
  { code: "bn-BD", name: "Bengali", category: "Complex-shaping", needsOverride: true },
  { code: "th-TH", name: "Thai", category: "Complex-shaping", needsOverride: true, note: "dictionary-based line-breaking, no spaces between words" },
  { code: "km-KH", name: "Khmer", category: "Complex-shaping", needsOverride: true, note: "dictionary-based line-breaking, no spaces between words" },
  // Turkish — no font issue, but needs locale-aware case-folding (İ/ı)
  { code: "tr-TR", name: "Turkish", category: "Turkish", needsOverride: true },
  // RTL
  { code: "fa-IR", name: "Persian/Farsi", category: "RTL", needsOverride: true, note: "own font + Extended Arabic-Indic digits" },
  { code: "ar-SA", name: "Arabic", category: "RTL", needsOverride: true },
  { code: "he-IL", name: "Hebrew", category: "RTL", needsOverride: true },
];

function localeByCode(code) {
  return LOCALE_CATALOG.find((l) => l.code === code);
}
