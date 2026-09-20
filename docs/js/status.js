async function fetchStatusJson(asset, locale) {
  try {
    const file = await ghFetch(`/repos/${ORG}/${CONTENT_REPO}/contents/${asset}/${locale}/status.json`);
    return JSON.parse(decodeBase64Utf8(file.content));
  } catch (err) {
    if (String(err).includes("404")) return null; // translate-draft.yml hasn't run for this locale yet
    throw err;
  }
}

function renderRow(tbody, asset, locale, summary) {
  const tr = document.createElement("tr");
  const total = summary.total || 0;
  const reviewed = summary.reviewed || 0;
  const pct = total ? Math.round((reviewed / total) * 100) : 0;
  tr.innerHTML = `
    <td>${asset}</td>
    <td>${locale}</td>
    <td>${total}</td>
    <td>${summary.draft || 0}</td>
    <td>${summary.in_review || 0}</td>
    <td>${reviewed}</td>
    <td>${summary.stale || 0}</td>
    <td>${summary.migrated || 0}</td>
    <td>${pct}%</td>
  `;
  tbody.appendChild(tr);
}

async function loadStatus() {
  const statusEl = document.getElementById("token-status");
  const tbody = document.querySelector("#status-table tbody");
  const messageEl = document.getElementById("status-message");
  tbody.innerHTML = "";
  messageEl.textContent = "Loading…";

  try {
    await verifyToken();
    statusEl.textContent = "✓ Token verified.";
    statusEl.className = "token-status token-status-ok";
  } catch (err) {
    statusEl.textContent = `✗ ${err.message}`;
    statusEl.className = "token-status token-status-error";
    messageEl.textContent = "";
    return;
  }

  const registry = await fetchRegistry();
  const assets = registry.assets || {};
  if (Object.keys(assets).length === 0) {
    messageEl.textContent = "No assets onboarded yet.";
    return;
  }

  let rows = 0;
  for (const [assetId, entry] of Object.entries(assets).sort()) {
    for (const locale of entry.locales || []) {
      const status = await fetchStatusJson(assetId, locale);
      if (status && status.summary) {
        renderRow(tbody, assetId, locale, status.summary);
        rows++;
      } else {
        renderRow(tbody, assetId, locale, { total: 0 });
        rows++;
      }
    }
  }
  messageEl.textContent = rows === 0 ? "No locales drafted yet." : "";
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = getToken();
  if (saved) {
    document.getElementById("gh-token").value = saved;
    loadStatus();
  }
  document.getElementById("verify-token-button").addEventListener("click", () => {
    setToken(document.getElementById("gh-token").value);
    loadStatus();
  });
});
