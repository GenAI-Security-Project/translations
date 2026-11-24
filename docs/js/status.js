const REPO_TREE_BASE = `https://github.com/${ORG}/${CONTENT_REPO}/tree/main`;
const NEW_ISSUE_URL = `https://github.com/${ORG}/${CONTENT_REPO}/issues/new`;
const LOCALE_CODE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

function languageLabel(code) {
  return LANGUAGE_NAMES[code] ? `${LANGUAGE_NAMES[code]} (${code})` : code;
}

// Opens the "Add languages" issue form with the document and languages
// chosen. GitHub pre-fills issue-form fields from query parameters named by
// field id; for the dropdowns the value is the option's label (see
// tooling/gen_issue_forms.py). Codes that aren't in the list go in the
// free-text "other" field.
function addLanguageUrl(assetId, codes) {
  const listed = codes.map(languageOptionLabel).filter(Boolean);
  const other = codes.filter((c) => !languageOptionLabel(c));
  const q = new URLSearchParams({
    template: "add-language.yml",
    title: `Add languages: ${assetId} — ${codes.join(", ")}`,
    asset: assetId,
  });
  if (listed.length) q.set("locales", listed.join(","));
  if (other.length) q.set("other_locales", other.join(", "));
  return `${NEW_ISSUE_URL}?${q}`;
}

// The "Add languages" button and its picker, for one document. Existing
// locales are shown ticked and locked; nothing is sent from here -- the
// request is made on GitHub, signed in, where the manager check runs.
function renderAddLanguages(section, assetId, existing) {
  const have = new Set(existing);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "secondary add-lang-toggle";
  toggle.textContent = "+ Add languages";
  toggle.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "add-lang-panel";
  panel.hidden = true;

  const intro = document.createElement("p");
  intro.className = "hint";
  intro.textContent =
    "Tick the languages to add, then press Request. GitHub opens the request form already filled in; " +
    "press Create there and machine drafting starts automatically. Translations managers only.";
  panel.appendChild(intro);

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Filter languages…";
  search.setAttribute("aria-label", "Filter languages");
  panel.appendChild(search);

  const grid = document.createElement("div");
  grid.className = "add-lang-grid";
  panel.appendChild(grid);

  const boxes = [];
  for (const [code, name, native] of LANGUAGES) {
    const label = document.createElement("label");
    label.className = "locale-row" + (have.has(code) ? " locale-row-disabled" : "");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = code;
    box.checked = have.has(code);
    box.disabled = have.has(code);
    const text = document.createElement("span");
    text.textContent = `${name} — ${native} `;
    const codeEl = document.createElement("code");
    codeEl.textContent = code;
    label.append(box, text, codeEl);
    if (have.has(code)) {
      const note = document.createElement("span");
      note.className = "locale-note";
      note.textContent = " already added";
      label.appendChild(note);
    }
    label.dataset.search = `${name} ${native} ${code}`.toLowerCase();
    grid.appendChild(label);
    boxes.push(box);
  }

  const otherLabel = document.createElement("label");
  otherLabel.textContent = "Other language codes (optional, comma-separated, e.g. mn-MN)";
  const other = document.createElement("input");
  other.type = "text";
  otherLabel.appendChild(other);
  panel.appendChild(otherLabel);

  const actions = document.createElement("p");
  const request = document.createElement("a");
  request.className = "button-link";
  request.target = "_blank";
  request.rel = "noopener";
  request.textContent = "Request translation →";
  const message = document.createElement("span");
  message.className = "hint add-lang-message";
  actions.append(request, message);
  panel.appendChild(actions);

  function selected() {
    const picked = boxes.filter((b) => b.checked && !b.disabled).map((b) => b.value);
    const typed = other.value.split(/[\s,]+/).map((c) => c.trim()).filter(Boolean);
    const bad = typed.filter((c) => !LOCALE_CODE_RE.test(c));
    const extra = typed.filter((c) => LOCALE_CODE_RE.test(c) && !have.has(c));
    return { codes: [...new Set([...picked, ...extra])], bad };
  }

  function refresh() {
    const { codes, bad } = selected();
    if (bad.length) {
      message.textContent = ` Not a language code: ${bad.join(", ")}`;
    } else if (codes.length === 0) {
      message.textContent = " Choose at least one language.";
    } else {
      message.textContent = ` ${codes.length} selected: ${codes.join(", ")}`;
    }
    const ok = codes.length > 0 && bad.length === 0;
    request.classList.toggle("button-link-disabled", !ok);
    request.setAttribute("aria-disabled", String(!ok));
    if (ok) request.href = addLanguageUrl(assetId, codes);
    else request.removeAttribute("href");
  }

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const label of grid.children) label.hidden = q !== "" && !label.dataset.search.includes(q);
  });
  grid.addEventListener("change", refresh);
  other.addEventListener("input", refresh);
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) search.focus();
  });
  refresh();

  section.append(toggle, panel);
}

async function fetchStatusJson(asset, locale) {
  const text = await fetchRawFile(`${asset}/${locale}/status.json`);
  return text === null ? null : JSON.parse(text); // null: translate-draft.yml hasn't merged for this locale yet
}

function progressLabel(summary) {
  const total = summary.total || 0;
  const reviewed = summary.reviewed || 0;
  if (total === 0) return { text: "no sections yet", cls: "status-pill status-pill-none" };
  if (reviewed === total) return { text: "complete", cls: "status-pill status-pill-done" };
  return { text: "in progress", cls: "status-pill status-pill-progress" };
}

function renderAssetSection(container, assetId, entry) {
  const section = document.createElement("section");
  section.className = "asset-block";

  const heading = document.createElement("h3");
  heading.innerHTML = `<a href="${REPO_TREE_BASE}/${assetId}" target="_blank">${assetId}</a>`;
  section.appendChild(heading);

  const meta = document.createElement("p");
  meta.className = "hint asset-meta";
  meta.textContent = `version ${entry.version} · ${entry.template}`;
  section.appendChild(meta);

  const list = document.createElement("ul");
  list.className = "locale-status-list";
  section.appendChild(list);
  renderAddLanguages(section, assetId, entry.locales || []);
  container.appendChild(section);
  return list;
}

function renderLocaleItem(list, assetId, locale, summary) {
  const li = document.createElement("li");
  li.className = "locale-status-item";

  const total = summary.total || 0;
  const { text: label, cls } = progressLabel(summary);
  const pct = total ? Math.round(((summary.reviewed || 0) / total) * 100) : 0;

  const linkOrPlain = total > 0
    ? `<a href="${REPO_TREE_BASE}/${assetId}/${locale}" target="_blank">${languageLabel(locale)}</a>`
    : `<span class="locale-not-started">${languageLabel(locale)}</span>`;

  li.innerHTML = `
    ${linkOrPlain}
    <span class="${cls} locale-progress-pill">${label}</span>
    ${total > 0 ? `<span class="locale-counts">${summary.reviewed || 0}/${total} reviewed (${pct}%) — ${summary.draft || 0} draft, ${summary.in_review || 0} in review, ${summary.stale || 0} stale</span>` : ""}
    <span class="locale-activity" aria-live="polite"></span>
  `;
  li.dataset.key = `${assetId}|${locale}`;
  li.dataset.hasSections = total > 0 ? "1" : "";
  list.appendChild(li);
}

// Counts come from the sections themselves rather than the file's stored
// "summary": a status.json updated by hand in a PR (the documented way to
// mark a later edit reviewed) may not carry an up-to-date summary.
function summarize(status) {
  const out = { total: 0, draft: 0, in_review: 0, reviewed: 0, stale: 0 };
  for (const s of Object.values((status && status.sections) || {})) {
    out.total++;
    if (s.status in out) out[s.status]++;
  }
  return out;
}

// Live activity (js/activity.js), refreshed in place. GitHub allows ~60
// unauthenticated API reads an hour per network and a refresh costs ~3, so:
// every 3 minutes while something is queued/drafting; otherwise only when
// the tab becomes visible again (at most every 2 minutes) or on "Refresh";
// and never automatically once fewer than 10 reads are left this hour.
const ACTIVE_REFRESH_MS = 3 * 60 * 1000;
const MIN_GAP_MS = 2 * 60 * 1000;
const LOW_BUDGET = 10;
let activityTimer = null;
let lastActivityAt = 0;

async function refreshActivity({ manual = false } = {}) {
  clearTimeout(activityTimer);
  const note = document.getElementById("activity-note");
  lastActivityAt = Date.now();
  const { byLocale, active, error } = await fetchActivity();
  for (const li of document.querySelectorAll(".locale-status-item[data-key]")) {
    const info = byLocale.get(li.dataset.key);
    const hasSections = li.dataset.hasSections === "1";
    renderActivity(li.querySelector(".locale-activity"), info, hasSections);
    // "no sections yet" is misleading once a draft is running or waiting in a PR.
    const pill = li.querySelector(".locale-progress-pill");
    if (pill && !hasSections) pill.hidden = Boolean(info && info.state !== "done" && info.state !== "failed");
  }

  const low = activityBudget.remaining !== null && activityBudget.remaining < LOW_BUDGET;
  if (note) {
    const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let text = error || `Live activity from GitHub · updated ${t}`;
    if (!error && low) {
      const back = activityBudget.reset ? new Date(activityBudget.reset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "within the hour";
      text += ` · auto-refresh paused until ${back} (GitHub's hourly limit for this network)`;
    } else if (!error && active) {
      text += " · refreshing every 3 minutes while drafting";
    }
    note.textContent = text + " · ";
    const btn = document.createElement("a");
    btn.href = "#";
    btn.textContent = "Refresh";
    btn.addEventListener("click", (e) => { e.preventDefault(); refreshActivity({ manual: true }); });
    note.appendChild(btn);
  }
  if (active && !low && !error) {
    activityTimer = setTimeout(() => {
      if (document.visibilityState === "visible") refreshActivity();
    }, ACTIVE_REFRESH_MS);
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !document.querySelector(".locale-status-item")) return;
  if (Date.now() - lastActivityAt < MIN_GAP_MS) return;
  if (activityBudget.remaining !== null && activityBudget.remaining < LOW_BUDGET) return;
  refreshActivity();
});

// CONTENT_REPO is public, so this reads with no token at all — see
// github-api.js. If GitHub's unauthenticated rate limit (60/hr per IP) is
// ever actually hit here, that would surface as a plain fetch error below.
async function loadStatus() {
  const container = document.getElementById("status-container");
  const messageEl = document.getElementById("status-message");
  container.innerHTML = "";
  messageEl.textContent = "Loading…";

  let registry;
  try {
    registry = await fetchRegistry();
  } catch (err) {
    messageEl.textContent = `✗ ${err.message}`;
    return;
  }

  const assets = registry.assets || {};
  if (Object.keys(assets).length === 0) {
    messageEl.textContent = "No assets onboarded yet.";
    return;
  }

  for (const [assetId, entry] of Object.entries(assets).sort()) {
    const list = renderAssetSection(container, assetId, entry);
    for (const locale of entry.locales || []) {
      const status = await fetchStatusJson(assetId, locale);
      renderLocaleItem(list, assetId, locale, summarize(status));
    }
  }
  messageEl.textContent = "";
  if (!document.getElementById("activity-note")) {
    const note = document.createElement("p");
    note.id = "activity-note";
    note.className = "hint activity-note";
    container.before(note);
  }
  refreshActivity();
}

document.addEventListener("DOMContentLoaded", loadStatus);
