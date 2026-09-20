const REPO_TREE_BASE = `https://github.com/${ORG}/${CONTENT_REPO}/tree/main`;

async function fetchStatusJson(asset, locale) {
  try {
    const file = await ghFetch(`/repos/${ORG}/${CONTENT_REPO}/contents/${asset}/${locale}/status.json`);
    return JSON.parse(decodeBase64Utf8(file.content));
  } catch (err) {
    if (String(err).includes("404")) return null; // translate-draft.yml hasn't merged for this locale yet
    throw err;
  }
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
    ? `<a href="${REPO_TREE_BASE}/${assetId}/${locale}" target="_blank">${locale}</a>`
    : `<span class="locale-not-started">${locale}</span>`;

  li.innerHTML = `
    ${linkOrPlain}
    <span class="${cls}">${label}</span>
    ${total > 0 ? `<span class="locale-counts">${summary.reviewed || 0}/${total} reviewed (${pct}%) — ${summary.draft || 0} draft, ${summary.in_review || 0} in review, ${summary.stale || 0} stale</span>` : ""}
  `;
  list.appendChild(li);
}

async function loadStatus() {
  const statusEl = document.getElementById("token-status");
  const container = document.getElementById("status-container");
  const messageEl = document.getElementById("status-message");
  container.innerHTML = "";
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

  for (const [assetId, entry] of Object.entries(assets).sort()) {
    const list = renderAssetSection(container, assetId, entry);
    for (const locale of entry.locales || []) {
      const status = await fetchStatusJson(assetId, locale);
      renderLocaleItem(list, assetId, locale, status && status.summary ? status.summary : {});
    }
  }
  messageEl.textContent = "";
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
