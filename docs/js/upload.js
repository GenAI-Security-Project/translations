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

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const version = document.getElementById("version-input").value.trim();
  const locales = selectedLocales();
  if (!version || locales.length === 0) {
    resultEl.textContent = "Version and at least one locale are required.";
    resultEl.className = "result-error";
    return;
  }

  const payload = { version, locales: locales.join(",") };

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
  submitButton.disabled = true;
  resultEl.textContent = "Uploading…";
  resultEl.className = "";

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

    await dispatchBootstrapAsset(payload);
    resultEl.innerHTML =
      "✓ Submitted. <code>bootstrap-asset</code> is now running — check the " +
      `<a href="https://github.com/GenAI-Security-Project/translations/actions" target="_blank">Actions tab</a> ` +
      "for progress, and the repo's Pull Requests once it opens the onboarding PR.";
    resultEl.className = "result-ok";
  } catch (err) {
    resultEl.textContent = `✗ ${err.message}`;
    resultEl.className = "result-error";
  } finally {
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
  });
  document.getElementById("locale-checklist").addEventListener("change", (e) => {
    if (e.target.classList.contains("locale-checkbox")) {
      const t = currentTemplate();
      if (t) refreshOverrideWarnings(t);
    }
  });
  document.getElementById("upload-form").addEventListener("submit", handleSubmit);
});
