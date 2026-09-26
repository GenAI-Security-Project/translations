// A live status bar for one GitHub Actions run, built on the polling
// helpers in github-api.js (listWorkflowRuns, getWorkflowRunJobs). Used by
// upload.js (bootstrap-asset.yml) and publish.js (publish-direct.yml) --
// both fire a repository_dispatch, which returns no run id, so the only
// way to show real progress is: snapshot existing run ids before
// dispatching, then poll the workflow's run list until a run id shows up
// that wasn't in that snapshot (see attributeRun), then poll that run's
// own jobs/steps until it finishes (see pollUntilDone).
//
// Two dispatches of the same workflow fired close together can't be told
// apart any other way -- the runs API doesn't expose a dispatch's
// client_payload -- so callers that fire more than one dispatch (publish.js)
// must attribute each one (wait for its run to appear) *before* firing the
// next, even though each bar then polls its own run to completion
// independently/concurrently after that. See publish.js.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RUN_URL = (runId) => `https://github.com/GenAI-Security-Project/translations/actions/runs/${runId}`;

const STEP_ICON = {
  pending: "○",
  in_progress: "◐",
  success: "✓",
  failure: "✗",
  skipped: "–",
  cancelled: "✗",
};

function stepDisplayStatus(step) {
  if (step.status !== "completed") return step.status === "in_progress" ? "in_progress" : "pending";
  return step.conclusion || "success";
}

class WorkflowStatusBar {
  // container: an element this renders into (its innerHTML is fully owned
  // once tracking starts). label: short text identifying what this bar is
  // tracking, e.g. an asset id or "asset / locale" pair, shown as a heading
  // when a page is running more than one of these at once (publish.js).
  constructor(container, label) {
    this.container = container;
    this.label = label;
    this.runId = null;
    this._renderWaiting("Submitted — waiting for the workflow to start…");
  }

  _shell(bodyHtml) {
    const heading = this.label ? `<div class="status-bar-label">${this.label}</div>` : "";
    this.container.innerHTML = `<div class="status-bar">${heading}${bodyHtml}</div>`;
  }

  _renderWaiting(message) {
    this._shell(`<p class="status-bar-message">${message}</p>`);
  }

  _renderError(message) {
    this._shell(`<p class="status-bar-message status-bar-message-error">✗ ${message}</p>`);
  }

  // Public entry point for a caller-side failure this bar never got to
  // observe itself (e.g. the dispatch call that was supposed to create the
  // run it would track failed outright) -- everything else here is
  // internal to attributeRun/pollUntilDone/track.
  renderError(message) {
    this._renderError(message);
  }

  _renderSteps(run, jobs) {
    const steps = jobs.flatMap((j) => j.steps || []);
    const total = steps.length;
    const done = steps.filter((s) => s.status === "completed").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : run.status === "completed" ? 100 : 0;

    const failed = steps.find((s) => s.status === "completed" && s.conclusion === "failure");
    const running = steps.find((s) => s.status === "in_progress");

    let summary;
    let barClass = "status-bar-fill-progress";
    if (run.status === "completed") {
      if (run.conclusion === "success") {
        summary = "✓ Completed successfully";
        barClass = "status-bar-fill-success";
      } else if (failed) {
        summary = `✗ Failed at "${failed.name}"`;
        barClass = "status-bar-fill-failure";
      } else {
        summary = `✗ ${run.conclusion || "did not complete"}`;
        barClass = "status-bar-fill-failure";
      }
    } else if (running) {
      summary = `Running: ${running.name}`;
    } else {
      summary = "Queued…";
    }

    const stepRows = steps
      .map((s) => {
        const status = stepDisplayStatus(s);
        return `<li class="status-bar-step status-bar-step-${status}"><span class="status-bar-step-icon">${STEP_ICON[status] || "○"}</span> ${s.name}</li>`;
      })
      .join("");

    this._shell(`
      <p class="status-bar-message">${summary}</p>
      <div class="status-bar-track"><div class="${barClass}" style="width:${pct}%"></div></div>
      <p class="status-bar-actions-heading">Actions:</p>
      <ul class="status-bar-steps">${stepRows}</ul>
      <a class="status-bar-link" href="${RUN_URL(run.id)}" target="_blank">View this run on GitHub →</a>
    `);
  }

  // Polls workflowFile's run list until a run id appears that isn't in
  // excludeIds (a Set, snapshotted by the caller immediately before its
  // dispatch call). Resolves with that run's id once found (does not wait
  // for it to finish -- see pollUntilDone for that), or null on timeout.
  async attributeRun(workflowFile, excludeIds, { timeoutMs = 30000, intervalMs = 2500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let runs;
      try {
        runs = await listWorkflowRuns(workflowFile, 15);
      } catch (err) {
        this._renderError(err.message);
        return null;
      }
      const fresh = runs.find((r) => !excludeIds.has(r.id));
      if (fresh) {
        this.runId = fresh.id;
        return fresh.id;
      }
      await sleep(intervalMs);
    }
    this._renderError(
      "Timed out waiting for the workflow to start. It may still be queued -- " +
      `check the <a href="https://github.com/GenAI-Security-Project/translations/actions" target="_blank">Actions tab</a>.`
    );
    return null;
  }

  // Polls one run's jobs/steps, updating the status bar each time, until
  // the run reports status "completed". Resolves with the final run object
  // (its .conclusion is the thing to check), or null if runId is null
  // (attributeRun already timed out and rendered its own error).
  async pollUntilDone(runId, { intervalMs = 4000, timeoutMs = 10 * 60 * 1000 } = {}) {
    if (runId == null) return null;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let jobs;
      try {
        jobs = await getWorkflowRunJobs(runId);
      } catch (err) {
        this._renderError(err.message);
        return null;
      }
      // The run's own status/conclusion isn't on the jobs response -- a job
      // reliably mirrors it (this pipeline's workflows are always one job),
      // and completed-with-no-jobs-yet only happens in the instant a run is
      // first created, before its job list populates.
      const job = jobs[0];
      const run = job
        ? { id: runId, status: job.status, conclusion: job.conclusion }
        : { id: runId, status: "queued", conclusion: null };
      this._renderSteps(run, jobs);
      if (run.status === "completed") return run;
      await sleep(intervalMs);
    }
    this._renderError(
      "Timed out watching this run. It may still be in progress -- " +
      `check it directly: <a href="${RUN_URL(runId)}" target="_blank">${RUN_URL(runId)}</a>.`
    );
    return null;
  }

  // Convenience wrapper: attribute, then poll to completion. excludeIds
  // must be snapshotted (listWorkflowRuns) by the caller *before* firing
  // the dispatch this bar is meant to track.
  async track(workflowFile, excludeIds) {
    const runId = await this.attributeRun(workflowFile, excludeIds);
    return this.pollUntilDone(runId);
  }
}

// Snapshot helper for the excludeIds a caller needs before dispatching --
// just the current run ids for a workflow, as a Set. Kept here (rather than
// inlined at each call site) so "how far back to look" (perPage) stays in
// one place.
async function snapshotRunIds(workflowFile) {
  const runs = await listWorkflowRuns(workflowFile, 15);
  return new Set(runs.map((r) => r.id));
}
