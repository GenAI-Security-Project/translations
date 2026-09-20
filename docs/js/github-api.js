// Thin GitHub REST API helper. CONTENT_REPO is public, so registry/status
// reads go through fetchRawFile() (raw.githubusercontent.com, no token, a
// much more generous rate limit than the REST API's 60/hour-per-IP
// unauthenticated cap). ghFetch is the REST API path, still used for
// everything else; it only attaches a token when sessionStorage has one.
// A token is still required to read the private
// TEMPLATES_REPO and to perform either of the two writes (putFile,
// dispatchBootstrapAsset): a user-pasted PAT (fine-grained or classic), kept
// only in sessionStorage — never sent anywhere but api.github.com, and
// cleared when the tab closes. See docs/README.md for why this form doesn't
// use "Sign in with GitHub": device-flow token exchange doesn't support
// CORS, so a purely static page (no backend, as the Build Spec requires)
// can't complete that flow.

const GH_API = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";
const ORG = "GenAI-Security-Project";
const CONTENT_REPO = "translations";
const TEMPLATES_REPO = "translations-templates";

function getToken() {
  return sessionStorage.getItem("gh_pat") || "";
}

function setToken(token) {
  sessionStorage.setItem("gh_pat", token.trim());
}

function clearToken() {
  sessionStorage.removeItem("gh_pat");
}

async function ghFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${GH_API}${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message ? `: ${body.message}` : "";
    } catch (_) {
      /* ignore parse failure, use bare status */
    }
    throw new Error(`GitHub API ${response.status} on ${path}${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

// Reads a public file straight from CONTENT_REPO's CDN mirror rather than
// api.github.com/contents — the latter counts against the 60/hour-per-IP
// unauthenticated core rate limit (shared with everyone else behind the
// same IP, e.g. an office NAT), which a page that reads on every load can
// burn through fast. raw.githubusercontent.com serves the same public
// bytes under a much more generous CDN-level limit instead. Returns null
// on a 404 (file doesn't exist yet) so callers don't need try/catch.
async function fetchRawFile(path) {
  const response = await fetch(`${RAW_BASE}/${ORG}/${CONTENT_REPO}/main/${path}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`raw.githubusercontent.com ${response.status} on ${path}`);
  return response.text();
}

// Verifies the token can actually read the still-private templates repo —
// the cheapest call that proves real collaborator access, not just a
// syntactically valid token. Checking CONTENT_REPO instead would no longer
// prove anything, since it's public and answers any token, valid or not
// (an outright garbage/expired one still 401s).
async function verifyToken() {
  return ghFetch(`/repos/${ORG}/${TEMPLATES_REPO}`);
}

// Returns the parsed registry.yaml (via js-yaml, loaded globally from the
// CDN <script> tag) or an empty {assets: {}} if it somehow doesn't exist yet.
async function fetchRegistry() {
  const text = await fetchRawFile("registry.yaml");
  if (text === null) return { assets: {} };
  return jsyaml.load(text) || { assets: {} };
}

// Which locale folders already exist under a template in translations-templates
// (private repo) — the live signal for the override-readiness warning, more
// authoritative than locales.js's static needsOverride flag alone.
async function fetchTemplateLocales(template) {
  try {
    const entries = await ghFetch(`/repos/${ORG}/${TEMPLATES_REPO}/contents/${template}`);
    return new Set(entries.filter((e) => e.type === "dir" && e.name !== "default").map((e) => e.name));
  } catch (err) {
    if (String(err).includes("404")) return new Set();
    throw err;
  }
}

function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeBase64Utf8FromArrayBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Commits a single file (create or update) directly to the default branch —
// used only to stage a raw upload under _incoming/, never for the actual
// registry/tree changes, which always go through bootstrap_asset.py's own
// PR (see .github/workflows/bootstrap-asset.yml).
async function putFile(path, contentBase64, message) {
  let sha;
  try {
    const existing = await ghFetch(`/repos/${ORG}/${CONTENT_REPO}/contents/${path}`);
    sha = existing.sha;
  } catch (_) {
    sha = undefined; // file doesn't exist yet — creating, not updating
  }
  return ghFetch(`/repos/${ORG}/${CONTENT_REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: contentBase64, sha }),
  });
}

// Fires bootstrap-asset.yml's repository_dispatch trigger.
async function dispatchBootstrapAsset(clientPayload) {
  return ghFetch(`/repos/${ORG}/${CONTENT_REPO}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ event_type: "bootstrap-asset", client_payload: clientPayload }),
  });
}

// Fires publish-direct.yml's repository_dispatch trigger -- one call per
// (asset, locale) pair, see publish.html/publish.js.
async function dispatchPublishDirect(clientPayload) {
  return ghFetch(`/repos/${ORG}/${CONTENT_REPO}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ event_type: "publish-direct", client_payload: clientPayload }),
  });
}
