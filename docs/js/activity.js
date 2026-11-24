// Live pipeline activity for the Documents & languages page: which
// languages are queued or being machine-drafted right now, which have a
// draft pull request waiting for review, and which drafting run failed.
//
// Everything is read from GitHub's public REST API with no token (the repo
// is public). Unauthenticated calls are limited to 60 an hour per IP; see
// apiGet() and status.js's refreshActivity() for how the page stays inside
// that. If the limit is hit the page shows no activity and says so.
//
// Where the facts come from:
//   - Drafting runs: translate-draft.yml, either called from
//     start-translations / onboard-from-issue (its jobs are named
//     "... draft (<asset>, <locale>) ...") or run by hand (its run name is
//     "translate-draft: <asset> / <locale>").
//   - Draft PRs: open PRs labelled status:draft / status:in_review, titled
//     "[<asset>] Draft translation: <locale>[ (partial)]".

const ACTIVITY_API = `https://api.github.com/repos/${ORG}/${CONTENT_REPO}`;
const FAILURE_WINDOW_MS = 3 * 24 * 3600 * 1000; // show a failed run for 3 days
const DRAFT_WORKFLOWS = ["translate-draft.yml", "start-translations.yml", "onboard-from-issue.yml"];
const JOB_RE = /draft \(([a-z0-9][a-z0-9.-]*), ([A-Za-z0-9-]+)\)/;
const RUN_NAME_RE = /^translate-draft: ([a-z0-9][a-z0-9.-]*) \/ ([A-Za-z0-9-]+)$/;
const PR_TITLE_RE = /^\[([a-z0-9][a-z0-9.-]*)\] Draft translation: ([A-Za-z0-9-]+)( \(partial\))?$/;

class RateLimited extends Error {}
// Last seen X-RateLimit-* values (GitHub exposes them to CORS requests).
const activityBudget = { remaining: null, reset: null };

// Rate-limit friendly reads. Unauthenticated, every call counts against
// GitHub's 60/hour/IP limit (304 revalidations included), so:
//  - jobs of a finished run never change: kept in sessionStorage for good;
//  - only CORS-safelisted headers are sent, so there's no preflight;
//  - the caller refreshes sparingly (status.js) and stops when
//    activityBudget.remaining runs low.
async function apiGet(path, { immutable = false } = {}) {
  const key = `gh-activity:${path}`;
  if (immutable) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(key) || "null");
      if (hit) return hit;
    } catch (_) { /* no cache available */ }
  }
  const res = await fetch(`${ACTIVITY_API}${path}`, {
    cache: "no-cache",
    headers: { Accept: "application/vnd.github+json" },
  });
  const rem = res.headers.get("x-ratelimit-remaining");
  if (rem !== null) {
    activityBudget.remaining = Number(rem);
    activityBudget.reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 || null;
  }
  if (res.status === 403 || res.status === 429) throw new RateLimited("GitHub rate limit reached");
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  if (immutable) {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (_) { /* fine */ }
  }
  return data;
}

function workflowFile(run) {
  return (run.path || "").split("/").pop();
}

// Returns { byLocale: Map("asset|locale" -> info), active: bool, error: string|null }.
// info: { state: "queued"|"drafting"|"failed"|"draft-pr"|"review-pr", url, since, partial, pr }
async function fetchActivity() {
  const byLocale = new Map();
  const put = (asset, locale, info) => {
    const key = `${asset}|${locale}`;
    const prev = byLocale.get(key);
    // Running work beats a PR, which beats an old failure; newer beats older.
    const rank = { drafting: 4, queued: 3, "draft-pr": 2, "review-pr": 2, failed: 1, done: 1 };
    if (!prev || rank[info.state] > rank[prev.state] ||
        (rank[info.state] === rank[prev.state] && (info.since || 0) > (prev.since || 0))) {
      byLocale.set(key, info);
    }
  };

  try {
    const [runsResp, prs] = await Promise.all([
      apiGet("/actions/runs?per_page=30"),
      apiGet("/pulls?state=open&per_page=100"),
    ]);

    for (const pr of prs) {
      const labels = (pr.labels || []).map((l) => l.name);
      const m = PR_TITLE_RE.exec(pr.title || "");
      if (!m || !(labels.includes("status:draft") || labels.includes("status:in_review"))) continue;
      put(m[1], m[2], {
        state: labels.includes("status:in_review") ? "review-pr" : "draft-pr",
        url: pr.html_url, pr: pr.number, partial: Boolean(m[3]),
        since: Date.parse(pr.created_at),
      });
    }

    const now = Date.now();
    // Running drafting runs, plus finished ones from the last few days (a
    // later success has to be able to clear an earlier failure). Capped so a
    // refresh never costs more than a handful of API calls.
    const runs = (runsResp.workflow_runs || []).filter((r) => {
      if (!DRAFT_WORKFLOWS.includes(workflowFile(r))) return false;
      if (r.status !== "completed") return true;
      return ["failure", "success"].includes(r.conclusion) && now - Date.parse(r.updated_at) < FAILURE_WINDOW_MS;
    }).slice(0, 6);

    for (const run of runs) {
      const direct = RUN_NAME_RE.exec(run.display_title || run.name || "");
      if (direct && workflowFile(run) === "translate-draft.yml") {
        put(direct[1], direct[2], runInfo(run.status, run.conclusion, run.html_url, run.run_started_at || run.created_at));
        continue;
      }
      const jobs = (await apiGet(`/actions/runs/${run.id}/jobs?per_page=100`, { immutable: run.status === "completed" })).jobs || [];
      for (const job of jobs) {
        const m = JOB_RE.exec(job.name || "");
        if (!m) continue;
        put(m[1], m[2], runInfo(job.status, job.conclusion, job.html_url, job.started_at || run.created_at));
      }
    }
    const active = [...byLocale.values()].some((i) => i.state === "queued" || i.state === "drafting");
    return { byLocale, active, error: null };
  } catch (err) {
    return {
      byLocale, active: false,
      error: err instanceof RateLimited
        ? "Live activity is paused: GitHub's hourly limit for this network was reached. It'll come back within the hour."
        : "Couldn't load live activity from GitHub.",
    };
  }
}

function runInfo(status, conclusion, url, started) {
  const since = Date.parse(started) || Date.now();
  if (status === "completed") {
    return conclusion === "failure" ? { state: "failed", url, since } : { state: "done", url, since };
  }
  if (status === "in_progress") return { state: "drafting", url, since };
  return { state: "queued", url, since };
}

function elapsed(since) {
  const min = Math.max(0, Math.round((Date.now() - since) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

// Fills (or empties) one language's activity slot.
function renderActivity(slot, info, hasSections) {
  slot.replaceChildren();
  if (!info || info.state === "done") return;
  const a = document.createElement("a");
  a.href = info.url;
  a.target = "_blank";
  a.rel = "noopener";
  const pill = document.createElement("span");
  switch (info.state) {
    case "queued":
      pill.className = "status-pill status-pill-queued";
      pill.textContent = "⏳ Queued";
      a.textContent = "details";
      break;
    case "drafting":
      pill.className = "status-pill status-pill-active";
      pill.textContent = `✎ Drafting… ${elapsed(info.since)}`;
      a.textContent = "watch progress";
      break;
    case "draft-pr":
      pill.className = "status-pill status-pill-ready";
      pill.textContent = info.partial ? "Partial draft ready for review" : "Draft ready for review";
      a.textContent = `PR #${info.pr}`;
      break;
    case "review-pr":
      pill.className = "status-pill status-pill-progress";
      pill.textContent = "Being reviewed";
      a.textContent = `PR #${info.pr}`;
      break;
    case "failed":
      pill.className = "status-pill status-pill-failed";
      pill.textContent = hasSections ? "Last drafting run failed" : "Drafting failed";
      a.textContent = "see log";
      break;
    default:
      return;
  }
  slot.append(pill, " ", a);
}
