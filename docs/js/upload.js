// Ties the upload.html form to github-api.js. See tooling/README.md's
// "Asset naming" section for the authoritative (Python) id-derivation logic
// this only previews client-side — the real id is always derived
// server-side by bootstrap_asset.py, never trusted from the browser.

let registryCache = null;
let templateLocalesCache = {}; // template -> Set(locale codes with an override)

function deriveAssetIdPreview(filename) {
  const stem = filename.replace(/\.[^/.]+$/, "");
  let tokens = stem.split(/[\s_-]+/).filter(Boolean);
  const noiseWordRe = /^(final|draft|rev|revision)\d*$/i;
  const vNumRe = /^v\d+$/i;
  tokens = tokens.filter((t) => !noiseWordRe.test(t) && !vNumRe.test(t));
  let slug = tokens.join("-").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  slug = slug.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || "asset";
}

// Same noise-word filtering as deriveAssetIdPreview, plus dropping purely
// numeric tokens (years, versions, day/page numbers) — those are exactly
// the part of a filename most likely to differ between two uploads of the
// same underlying document (a new edition, a version bump), so keeping
// them in a *duplicate-detection* comparison would hide the very case this
// check exists to catch.
function titleTokens(idOrFilename) {
  const stem = idOrFilename.replace(/\.[^/.]+$/, "");
  const tokens = stem.split(/[\s_-]+/).filter(Boolean).map((t) => t.toLowerCase());
  const noiseWordRe = /^(final|draft|rev|revision)\d*$/i;
  const vNumRe = /^v\d+$/i;
  const numericRe = /^\d+$/;
  return tokens.filter((t) => !noiseWordRe.test(t) && !vNumRe.test(t) && !numericRe.test(t));
}

// Overlap coefficient (intersection / smaller set's size), not Jaccard —
// deliberately so an abbreviated re-upload ("Agentic Top 10 Final v3" vs.
// the full "OWASP Top 10 for Agentic Applications") still scores as a
// near-total match: every word in the shorter title appears in the longer
// one, which Jaccard would under-score just for being short.
function overlapCoefficient(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  return intersection / Math.min(setA.size, setB.size);
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

// Best-matching existing asset for this filename, or null. Non-blocking by
// design: a false positive costs the user one extra confirmation click; a
// missed true positive is exactly what this exists to reduce, so the
// threshold errs toward flagging more rather than fewer candidates.
function findLikelyDuplicate(filename) {
  if (!registryCache) return null;
  const newTokens = titleTokens(filename);
  let best = null;
  for (const [assetId, entry] of Object.entries(registryCache.assets || {})) {
    const score = overlapCoefficient(newTokens, titleTokens(assetId));
    if (score >= DUPLICATE_SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { assetId, entry, score };
    }
  }
  return best;
}

function splitByForFilename(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "docx") return "heading_1";
  if (ext === "pdf") return "pdf_heading";
  return null;
}

function renderLocaleChecklist(container, disabledCodes = new Set()) {
  container.innerHTML = "";
  const byCategory = {};
  for (const locale of LOCALE_CATALOG) {
    (byCategory[locale.category] ||= []).push(locale);
  }
  for (const [category, locales] of Object.entries(byCategory)) {
    const group = document.createElement("fieldset");
    group.className = "locale-group";
    const legend = document.createElement("legend");
    legend.textContent = category;
    group.appendChild(legend);

    for (const locale of locales) {
      const row = document.createElement("label");
      row.className = "locale-row";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = locale.code;
      checkbox.className = "locale-checkbox";
      if (disabledCodes.has(locale.code)) {
        checkbox.disabled = true;
        row.classList.add("locale-row-disabled");
      }
      row.appendChild(checkbox);
      row.appendChild(document.createTextNode(` ${locale.name} (${locale.code})`));
      if (disabledCodes.has(locale.code)) {
        const already = document.createElement("span");
        already.className = "locale-note";
        already.textContent = " — already added";
        row.appendChild(already);
      }
      const warn = document.createElement("span");
      warn.className = "locale-warning";
      warn.dataset.code = locale.code;
      row.appendChild(warn);
      group.appendChild(row);
    }
    container.appendChild(group);
  }
}

async function refreshOverrideWarnings(template) {
  if (!templateLocalesCache[template]) {
    templateLocalesCache[template] = await fetchTemplateLocales(template);
  }
  const covered = templateLocalesCache[template];
  document.querySelectorAll(".locale-warning").forEach((el) => {
    const locale = localeByCode(el.dataset.code);
    const checkbox = document.querySelector(`.locale-checkbox[value="${locale.code}"]`);
    const needsOverride = locale.needsOverride && !covered.has(locale.code);
    el.textContent = needsOverride && checkbox.checked
      ? " ⚠ no render override yet — draft translation proceeds, but this locale can't publish until an admin adds one"
      : "";
  });
}

function selectedLocales() {
  return Array.from(document.querySelectorAll(".locale-checkbox:checked")).map((el) => el.value);
}

let submitBlockedByDuplicate = false;

// Two-layer check, run whenever the selected file or locales change (new-
// asset mode only — "existing asset" mode already disables already-added
// locales directly via the checklist). Layer 1: does this filename look
// like an existing asset (findLikelyDuplicate)? Layer 2, only if layer 1
// matched: is one of the *currently selected* locales already registered
// for that asset? That second layer is the meaningful distinction between
// "heads up, double-check this" and "this exact translation already
// exists" — same asset match, different selected locale, is a completely
// normal add-a-locale case dressed up as a new upload, not a duplicate.
function checkDuplicateAndLocales() {
  const container = document.getElementById("duplicate-warning");
  const submitButton = document.getElementById("submit-button");
  container.innerHTML = "";
  submitBlockedByDuplicate = false;

  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];
  if (!file) {
    submitButton.disabled = false;
    return;
  }

  const match = findLikelyDuplicate(file.name);
  if (!match) {
    submitButton.disabled = false;
    return;
  }

  const assetLocales = match.entry.locales || [];
  const selected = selectedLocales();
  const colliding = selected.filter((loc) => assetLocales.includes(loc));
  const assetUrl = `https://github.com/${ORG}/${CONTENT_REPO}/tree/main/${match.assetId}`;

  if (colliding.length > 0) {
    // Same document, and the exact locale(s) requested already exist for
    // it — per instruction, do nothing further: block submission and hand
    // the user back to the home page rather than let them proceed.
    submitBlockedByDuplicate = true;
    submitButton.disabled = true;
    container.innerHTML = `
      <div class="duplicate-block">
        <p><strong>This translation already exists.</strong> "${file.name}" looks like the
        existing asset <a href="${assetUrl}" target="_blank">${match.assetId}</a>, which
        already has <strong>${colliding.join(", ")}</strong> registered.</p>
        <a href="index.html"><button type="button">Return to home</button></a>
      </div>`;
    return;
  }

  submitButton.disabled = false;
  const otherLocales = assetLocales.length
    ? `Locales already added to it: ${assetLocales.join(", ")}.`
    : "It has no locales added yet.";
  container.innerHTML = `
    <div class="duplicate-warning-soft">
      <p>⚠ "${file.name}" looks similar to the existing asset
      <a href="${assetUrl}" target="_blank">${match.assetId}</a>. ${otherLocales}
      If this is the same document, use that asset instead of creating a new one.</p>
      <button type="button" id="use-existing-instead-button" data-asset-id="${match.assetId}">
        Use "${match.assetId}" instead
      </button>
      <label class="duplicate-confirm-label">
        <input type="checkbox" id="confirm-different-document" />
        This is a genuinely different, new document — continue as a new asset
      </label>
    </div>`;

  document.getElementById("use-existing-instead-button").addEventListener("click", () => {
    document.querySelector('input[name="mode"][value="existing"]').checked = true;
    document.getElementById("existing-asset-select").value = match.assetId;
    handleModeChange();
    container.innerHTML = "";
    submitButton.disabled = false;
  });
  document.getElementById("confirm-different-document").addEventListener("change", (e) => {
    submitBlockedByDuplicate = !e.target.checked;
  });
  submitBlockedByDuplicate = true; // requires the checkbox above until explicitly confirmed
}

async function handleVerifyToken(statusEl) {
  const tokenInput = document.getElementById("gh-token");
  setToken(tokenInput.value);
  statusEl.textContent = "Verifying…";
  statusEl.className = "token-status";
  try {
    await verifyToken();
    statusEl.textContent = "✓ Token verified — write access to the repo confirmed.";
    statusEl.className = "token-status token-status-ok";
    document.getElementById("form-body").hidden = false;
    registryCache = await fetchRegistry();
    populateExistingAssetDropdown();
  } catch (err) {
    statusEl.textContent = `✗ ${err.message}`;
    statusEl.className = "token-status token-status-error";
    document.getElementById("form-body").hidden = true;
  }
}

function populateExistingAssetDropdown() {
  const select = document.getElementById("existing-asset-select");
  select.innerHTML = '<option value="">— choose an asset —</option>';
  for (const id of Object.keys(registryCache.assets || {}).sort()) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    select.appendChild(opt);
  }
}

function handleModeChange() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  document.getElementById("new-asset-fields").hidden = mode !== "new";
  document.getElementById("existing-asset-fields").hidden = mode !== "existing";
  const disabled = new Set();
  if (mode === "existing") {
    const id = document.getElementById("existing-asset-select").value;
    const entry = id && registryCache && registryCache.assets[id];
    if (entry) for (const code of entry.locales || []) disabled.add(code);
  }
  renderLocaleChecklist(document.getElementById("locale-checklist"), disabled);
  const template = currentTemplate();
  if (template) refreshOverrideWarnings(template);

  if (mode === "new") {
    checkDuplicateAndLocales();
  } else {
    document.getElementById("duplicate-warning").innerHTML = "";
    submitBlockedByDuplicate = false;
    document.getElementById("submit-button").disabled = false;
  }
}

function currentTemplate() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === "new") return document.getElementById("template-select").value || null;
  const id = document.getElementById("existing-asset-select").value;
  const entry = id && registryCache && registryCache.assets[id];
  return entry ? entry.template : null;
}

async function handleSubmit(event) {
  event.preventDefault();
  const resultEl = document.getElementById("submit-result");
  resultEl.textContent = "";
  resultEl.className = "";

  if (!checkCaptcha(document.getElementById("captcha-container"))) {
    resultEl.textContent = "Captcha answer was incorrect — try the new problem above.";
    resultEl.className = "result-error";
    return;
  }

  const totpCode = document.getElementById("totp-input").value.trim();
  if (!/^\d{6}$/.test(totpCode)) {
    resultEl.textContent = "Enter the current 6-digit authenticator code.";
    resultEl.className = "result-error";
    return;
  }

  const mode = document.querySelector('input[name="mode"]:checked').value;
  if (mode === "new" && submitBlockedByDuplicate) {
    resultEl.textContent = "Resolve the duplicate-asset check above before submitting.";
    resultEl.className = "result-error";
    return;
  }

  const version = document.getElementById("version-input").value.trim();
  const locales = selectedLocales();
  if (!version || locales.length === 0) {
    resultEl.textContent = "Version and at least one locale are required.";
    resultEl.className = "result-error";
    return;
  }

  const payload = { version, locales: locales.join(","), totp_code: totpCode };

  if (mode === "existing") {
    const assetId = document.getElementById("existing-asset-select").value;
    if (!assetId) {
      resultEl.textContent = "Choose an existing asset, or switch to \"New asset\".";
      resultEl.className = "result-error";
      return;
    }
    payload.asset = assetId;
  } else {
    const fileInput = document.getElementById("file-input");
    const template = document.getElementById("template-select").value;
    if (!fileInput.files[0] || !template) {
      resultEl.textContent = "A file and a template are required for a new asset.";
      resultEl.className = "result-error";
      return;
    }
    payload.template = template;
    payload.split_by = splitByForFilename(fileInput.files[0].name);
    if (!payload.split_by) {
      resultEl.textContent = "The uploaded file must be .docx or .pdf.";
      resultEl.className = "result-error";
      return;
    }
    const sourceRepo = document.getElementById("source-repo-input").value.trim();
    const sourcePath = document.getElementById("source-path-input").value.trim();
    const owners = document.getElementById("owners-input").value.trim();
    if (sourceRepo) payload.source_repo = sourceRepo;
    if (sourcePath) payload.source_path = sourcePath;
    if (owners) payload.owners = owners;
    // asset is left unset — bootstrap_asset.py derives the real id server-side
  }

  const submitButton = document.getElementById("submit-button");
  const statusBarEl = document.getElementById("submit-status-bar");
  submitButton.disabled = true;
  resultEl.textContent = "";
  resultEl.className = "";
  statusBarEl.innerHTML = "";

  try {
    if (mode === "new") {
      const fileInput = document.getElementById("file-input");
      const file = fileInput.files[0];
      const buffer = await file.arrayBuffer();
      const base64 = encodeBase64Utf8FromArrayBuffer(buffer);
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const incomingPath = `_incoming/${Date.now()}-${safeName}`;
      await putFile(incomingPath, base64, `Stage upload: ${file.name}`);
      payload.uploaded_path = incomingPath;
    }

    // Snapshotted immediately before dispatching -- see workflow-status.js's
    // header comment on why this has to happen before, not after.
    const beforeRunIds = await snapshotRunIds("bootstrap-asset.yml");
    await dispatchBootstrapAsset(payload);
    resultEl.innerHTML = "✓ Submitted.";
    resultEl.className = "result-ok";
    submitButton.disabled = false; // re-enabled once dispatched -- tracking below can run for minutes and shouldn't block a second submission

    const bar = new WorkflowStatusBar(statusBarEl, null);
    const run = await bar.track("bootstrap-asset.yml", beforeRunIds);
    if (run && run.conclusion === "success") {
      resultEl.innerHTML =
        "✓ Onboarding finished — check the repo's " +
        `<a href="https://github.com/GenAI-Security-Project/translations/pulls" target="_blank">Pull Requests</a> ` +
        "for the onboarding PR it opened. Merging that PR starts drafting the translation(s) for any newly added locale.";
    }
  } catch (err) {
    resultEl.textContent = `✗ ${err.message}`;
    resultEl.className = "result-error";
    submitButton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderCaptcha(document.getElementById("captcha-container"));
  renderLocaleChecklist(document.getElementById("locale-checklist"));

  document.getElementById("verify-token-button").addEventListener("click", () => {
    handleVerifyToken(document.getElementById("token-status"));
  });
  document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener("change", handleModeChange));
  document.getElementById("existing-asset-select").addEventListener("change", handleModeChange);
  document.getElementById("template-select").addEventListener("change", () => {
    const t = currentTemplate();
    if (t) refreshOverrideWarnings(t);
  });
  document.getElementById("file-input").addEventListener("change", (e) => {
    const preview = document.getElementById("asset-id-preview");
    if (e.target.files[0]) {
      preview.textContent = `Asset id will be derived as: ${deriveAssetIdPreview(e.target.files[0].name)}`;
    } else {
      preview.textContent = "";
    }
    checkDuplicateAndLocales();
  });
  document.getElementById("locale-checklist").addEventListener("change", (e) => {
    if (e.target.classList.contains("locale-checkbox")) {
      const t = currentTemplate();
      if (t) refreshOverrideWarnings(t);
      if (document.querySelector('input[name="mode"]:checked').value === "new") {
        checkDuplicateAndLocales();
      }
    }
  });
  document.getElementById("upload-form").addEventListener("submit", handleSubmit);
});
