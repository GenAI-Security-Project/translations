// Read-only helpers for the GitHub Pages site. No page handles a token:
// everything here reads the public CONTENT_REPO through
// raw.githubusercontent.com (no auth, and a far more generous rate limit
// than the REST API's 60/hour-per-IP unauthenticated cap). Anything that
// changes the repo -- onboarding, adding languages, drafting, layout
// handoff, publishing -- happens on GitHub itself (an issue form or an
// Actions "Run workflow" form) under the person's own GitHub sign-in, and
// each workflow checks server-side that they're a translations manager
// (.github/actions/require-manager). See docs/README.md.

const ORG = "GenAI-Security-Project";
const CONTENT_REPO = "translations";
const RAW_BASE = "https://raw.githubusercontent.com";

// Returns null on a 404 (file doesn't exist yet) so callers don't need
// try/catch for that case.
async function fetchRawFile(path) {
  const response = await fetch(`${RAW_BASE}/${ORG}/${CONTENT_REPO}/main/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`raw.githubusercontent.com ${response.status} on ${path}`);
  return response.text();
}

// Returns the parsed registry.yaml (via js-yaml, loaded globally from the
// CDN <script> tag) or an empty {assets: {}} if it somehow doesn't exist yet.
async function fetchRegistry() {
  const text = await fetchRawFile("registry.yaml");
  if (text === null) return { assets: {} };
  return jsyaml.load(text) || { assets: {} };
}
