// Publish page -- for now it offers only Process 4 (Assemble for Layout,
// .github/workflows/layout-handoff.yml). The page itself needs no token: it
// reads registry.yaml and each status.json from the public repo, and hands
// off to GitHub's own "Run workflow" form, where the person is already
// signed in to GitHub. Who may actually run it is enforced by the workflow
// (.github/actions/require-manager), not here.
//
// The previous direct-publish path (publish-direct.yml, Process 2 testing
// route) is intentionally not offered while Process 2 is being set up; the
// workflow and its dispatch helper still exist.

const LAYOUT_WORKFLOW_URL =
  `https://github.com/${ORG}/${CONTENT_REPO}/actions/workflows/layout-handoff.yml`;

async function fetchStatusJson(asset, locale) {
  const text = await fetchRawFile(`${asset}/${locale}/status.json`);
  return text === null ? null : JSON.parse(text);
}

// Counted from the sections themselves rather than a stored summary, so the
// "ready" verdict matches exactly what the workflow's reviewed-only gate
// checks.
function reviewCounts(status) {
  const sections = Object.values((status && status.sections) || {});
  const reviewed = sections.filter((s) => s.status === "reviewed").length;
  return { reviewed, total: sections.length };
}

function makeCopyButton(text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "secondary";
  btn.textContent = "Copy asset id";
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied ✓";
    } catch (_) {
      btn.textContent = "Copy failed — select the id manually";
    }
    setTimeout(() => { btn.textContent = "Copy asset id"; }, 2500);
  });
  return btn;
}

async function loadPublishTable() {
  const tbody = document.getElementById("publish-table-body");
  const table = document.getElementById("publish-table");
  const messageEl = document.getElementById("table-message");
  tbody.innerHTML = "";

  let registry;
  try {
    registry = await fetchRegistry();
  } catch (err) {
    messageEl.textContent = `✗ ${err.message}`;
    return;
  }

  let rowCount = 0;
  for (const [assetId, entry] of Object.entries(registry.assets || {}).sort()) {
    for (const locale of (entry.locales || []).slice().sort()) {
      let status = null;
      try {
        status = await fetchStatusJson(assetId, locale);
      } catch (_) { /* shown as no sections */ }
      const { reviewed, total } = reviewCounts(status);
      const ready = total > 0 && reviewed === total;

      const tr = document.createElement("tr");

      const assetCell = document.createElement("td");
      const code = document.createElement("code");
      code.textContent = assetId;
      assetCell.appendChild(code);

      const localeCell = document.createElement("td");
      localeCell.textContent = locale;

      const statusCell = document.createElement("td");
      if (total === 0) {
        statusCell.innerHTML = '<span class="status-pill status-pill-none">no sections yet</span>';
      } else if (ready) {
        statusCell.innerHTML = `${reviewed}/${total} reviewed <span class="status-pill status-pill-done">ready</span>`;
      } else {
        statusCell.innerHTML = `${reviewed}/${total} reviewed <span class="status-pill status-pill-progress">not fully reviewed</span>`;
      }

      const actionCell = document.createElement("td");
      if (ready) {
        actionCell.appendChild(makeCopyButton(assetId));
        actionCell.appendChild(document.createTextNode(" "));
        const link = document.createElement("a");
        link.href = LAYOUT_WORKFLOW_URL;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = `Run layout handoff (${locale}) →`;
        actionCell.appendChild(link);
      } else {
        actionCell.innerHTML = '<span class="hint">available once every section is reviewed</span>';
      }

      tr.append(assetCell, localeCell, statusCell, actionCell);
      tbody.appendChild(tr);
      rowCount++;
    }
  }

  if (rowCount === 0) {
    messageEl.textContent = "No documents registered yet.";
    table.hidden = true;
  } else {
    messageEl.textContent = "";
    table.hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("recent-runs-link").href = LAYOUT_WORKFLOW_URL;
  loadPublishTable();
});
