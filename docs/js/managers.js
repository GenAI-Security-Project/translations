// Managers page: renders docs/data/managers.json, which the sync-managers
// workflow writes from the repository's collaborator roles (Maintain/Admin).
const ROLE_LABEL = {
  maintain: "Manager (Maintain)",
  admin: "Admin (org owner or repository admin)",
};

async function loadManagers() {
  const msg = document.getElementById("managers-message");
  const list = document.getElementById("managers-list");
  let data;
  try {
    const res = await fetch("data/managers.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch (_) {
    msg.textContent = "The managers list isn't available yet.";
    return;
  }
  for (const m of data.managers || []) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.src = `${m.avatar}${m.avatar.includes("?") ? "&" : "?"}s=96`;
    img.alt = "";
    img.width = 48;
    img.height = 48;
    img.loading = "lazy";
    const who = document.createElement("div");
    const a = document.createElement("a");
    a.href = m.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = `@${m.login}`;
    const role = document.createElement("p");
    role.textContent = ROLE_LABEL[m.role] || m.role;
    who.append(a, role);
    li.append(img, who);
    list.appendChild(li);
  }
  const when = data.generated_at ? new Date(data.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
  msg.textContent = `${(data.managers || []).length} people can run the pipeline${when ? ` · list updated ${when}` : ""}.`;
  list.hidden = false;
}

document.addEventListener("DOMContentLoaded", loadManagers);
