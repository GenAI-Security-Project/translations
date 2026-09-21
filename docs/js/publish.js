// TODO: flip to false once real sign-off practices + fully-reviewed real
// content exist. true: every asset/locale is listed and selectable
// regardless of review completeness, so the rendering pipeline can be
// tested end-to-end before anything is actually fully reviewed. Either
// way, requesting a real final render (unchecking "Include watermark") on
// a locale that isn't fully reviewed is still refused server-side by
// render.sh's own --final check -- this flag only controls what the table
// here shows/allows selecting, never what the workflow actually accepts.
const TESTING_MODE = true;

const statusCache = {};

async function fetchStatusJsonCached(asset, locale) {
  const key = `${asset}|${locale}`;
  if (key in statusCache) return statusCache[key];
  const text = await fetchRawFile(`${asset}/${locale}/status.json`);
  const value = text === null ? null : JSON.parse(text);
  statusCache[key] = value;
  return value;
}

async function loadPublishTable() {
  const tbody = document.getElementById("publish-table-body");
  const table = document.getElementById("publish-table");
  const messageEl = document.getElementById("table-message");
  document.getElementById("testing-mode-notice").hidden = !TESTING_MODE;
  tbody.innerHTML = "";
  messageEl.textContent = "Loading…";

  let registry;
  try {
    registry = await fetchRegistry();
  } catch (err) {
    messageEl.textContent = `✗ ${err.message}`;
    return;
  }

  const assets = registry.assets || {};
  let rowCount = 0;
  for (const [assetId, entry] of Object.entries(assets).sort()) {
    for (const locale of (entry.locales || []).slice().sort()) {
      const status = await fetchStatusJsonCached(assetId, locale);
      const summary = (status && status.summary) || {};
      const total = summary.total || 0;
      const reviewed = summary.reviewed || 0;
      const fullyReviewed = total > 0 && reviewed === total;

      // Real behavior: only a fully-reviewed locale is publishable at all.
      // TESTING_MODE lists everything so the pipeline itself can be tested.
      if (!fullyReviewed && !TESTING_MODE) continue;

      const tr = document.createElement("tr");

      const checkboxCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "publish-row-checkbox";
      checkbox.dataset.asset = assetId;
      checkbox.dataset.locale = locale;
      checkboxCell.appendChild(checkbox);

      const assetCell = document.createElement("td");
      assetCell.textContent = assetId;

      const localeCell = document.createElement("td");
      localeCell.textContent = locale;

      const statusCell = document.createElement("td");
      if (total === 0) {
        statusCell.innerHTML = '<span class="status-pill status-pill-none">no sections yet</span>';
      } else if (fullyReviewed) {
        statusCell.innerHTML = `${reviewed}/${total} reviewed <span class="status-pill status-pill-done">approved</span>`;
      } else {
        statusCell.innerHTML = `${reviewed}/${total} reviewed <span class="status-pill status-pill-progress">not fully reviewed</span>`;
      }

      tr.appendChild(checkboxCell);
      tr.appendChild(assetCell);
      tr.appendChild(localeCell);
      tr.appendChild(statusCell);
      tbody.appendChild(tr);
      rowCount++;
    }
  }

  if (rowCount === 0) {
    messageEl.textContent = "No assets/locales available to publish.";
    table.hidden = true;
  } else {
    messageEl.textContent = "";
    table.hidden = false;
  }
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
    await loadPublishTable();
  } catch (err) {
    statusEl.textContent = `✗ ${err.message}`;
    statusEl.className = "token-status token-status-error";
    document.getElementById("form-body").hidden = true;
  }
}

async function handlePublish(event) {
  event.preventDefault();
  const resultEl = document.getElementById("publish-result");
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

  const checked = Array.from(document.querySelectorAll(".publish-row-checkbox:checked"));
  if (checked.length === 0) {
    resultEl.textContent = "Select at least one document/locale to publish.";
    resultEl.className = "result-error";
    return;
  }

  const includeWatermark = document.getElementById("include-watermark-checkbox").checked;

  const publishButton = document.getElementById("publish-button");
  const barsContainer = document.getElementById("publish-status-bars");
  publishButton.disabled = true;
  resultEl.textContent = `Submitting ${checked.length} publish request(s)…`;
  resultEl.className = "";
  barsContainer.innerHTML = "";

  // Snapshotted once, before the first dispatch -- each request's status
  // bar adds its own attributed run id as it's found, so the next
  // request's attribution can't mistake an already-claimed run for its
  // own. See workflow-status.js's header comment for why this can't just
  // be done per-request after the fact.
  let excludeIds;
  try {
    excludeIds = await snapshotRunIds("publish-direct.yml");
  } catch (_) {
    excludeIds = new Set(); // best effort -- attribution may then take a moment longer, not fail outright
  }

  const successes = [];
  const failures = [];
  const pending = [];
  for (const checkbox of checked) {
    const { asset, locale } = checkbox.dataset;
    const label = `${asset} / ${locale}`;
    const barEl = document.createElement("div");
    barEl.className = "status-bar-row";
    barsContainer.appendChild(barEl);
    const bar = new WorkflowStatusBar(barEl, label);

    try {
      await dispatchPublishDirect({ asset, locale, watermark: includeWatermark, totp_code: totpCode });
      successes.push(label);
    } catch (err) {
      failures.push(`${label}: ${err.message}`);
      bar.renderError(err.message);
      continue;
    }

    // Attribute this request's run *before* the next dispatch fires (see
    // above), then let it poll to completion in the background so waiting
    // for one slow run doesn't hold up submitting the rest.
    const runId = await bar.attributeRun("publish-direct.yml", excludeIds);
    if (runId != null) excludeIds.add(runId);
    pending.push(bar.pollUntilDone(runId));
  }

  let summary = "";
  if (successes.length) {
    summary += `✓ Submitted: ${successes.join(", ")}. Progress for each is shown below.`;
  }
  if (failures.length) {
    summary += `${summary ? "<br>" : ""}✗ Failed to submit: ${failures.join("; ")}`;
  }
  resultEl.innerHTML = summary;
  resultEl.className = failures.length ? "result-error" : "result-ok";
  publishButton.disabled = false;

  // Not awaited -- the form handler is done; each bar renders its own
  // outcome as its run progresses. Kept only so nothing here is treated as
  // an unhandled/orphaned promise.
  Promise.allSettled(pending);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCaptcha(document.getElementById("captcha-container"));
  document.getElementById("verify-token-button").addEventListener("click", () => {
    handleVerifyToken(document.getElementById("token-status"));
  });
  document.getElementById("publish-form").addEventListener("submit", handlePublish);
});
