// Light / dark theme. By default the site follows the system setting
// (prefers-color-scheme, see css/style.css); the header's theme button
// cycles Auto -> Light -> Dark and remembers the choice in this browser
// only. Loaded in <head> so the saved theme applies before first paint.
(function () {
  const KEY = "genai-translations-theme";
  const ORDER = ["auto", "light", "dark"];
  const LABEL = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };

  function read() {
    try {
      const v = localStorage.getItem(KEY);
      return ORDER.includes(v) ? v : "auto";
    } catch (_) {
      return "auto";
    }
  }

  function apply(mode) {
    const root = document.documentElement;
    if (mode === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
  }

  let mode = read();
  apply(mode);

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const show = () => {
      btn.textContent = LABEL[mode];
      btn.title = "Theme (Auto follows your system setting)";
      btn.setAttribute("aria-label", `Theme: ${mode}. Change theme`);
    };
    show();
    btn.addEventListener("click", () => {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      apply(mode);
      try { localStorage.setItem(KEY, mode); } catch (_) { /* not saved; still applied */ }
      show();
    });
  });
})();
