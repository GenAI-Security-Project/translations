const REPO_TREE_BASE = `https://github.com/${ORG}/${CONTENT_REPO}/tree/main`;

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
      renderLocaleItem(list, assetId, locale, status && status.summary ? status.summary : {});
    }
  }
  messageEl.textContent = "";
}

document.addEventListener("DOMContentLoaded", loadStatus);
