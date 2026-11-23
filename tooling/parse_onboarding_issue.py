"""Read an "Onboard a document" issue form (.github/ISSUE_TEMPLATE/
onboard-document.yml), or an "Add languages" one (add-language.yml, when
$FORM is "add-language"), into the JSON payload bootstrap-asset.yml takes.

Used by .github/workflows/onboard-from-issue.yml. Reads the issue body from
$BODY and the issue author from $AUTHOR; writes `payload=<json>` to
$GITHUB_OUTPUT. Exits non-zero, with a ::error:: line saying what's wrong,
on anything it can't use -- every value is validated here because the
issue text is user-supplied.

GitHub renders an issue form as "### <field label>\\n\\n<value>" blocks, with
"_No response_" for empty optional fields; fields are matched by the start
of their label so wording tweaks in the template don't break parsing.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import unquote, urlparse

LOCALE_RE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")
VERSION_RE = re.compile(r"^[0-9A-Za-z][0-9A-Za-z._-]{0,40}$")
ASSET_RE = re.compile(r"^[a-z0-9][a-z0-9.-]{0,120}$")
USER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
REPO_RE = re.compile(r"^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$")
PATH_RE = re.compile(r"^[A-Za-z0-9._/-]{1,200}$")
TEMPLATES = {"green-template", "blue-template", "yellow-template"}
SPLIT_BY = {".docx": "heading_1", ".pdf": "pdf_heading"}
# Where GitHub stores files dragged into an issue.
ATTACHMENT_HOSTS = {"github.com"}
ATTACHMENT_PATH_RE = re.compile(r"^/(user-attachments/files/\d+/|[^/]+/[^/]+/files/\d+/)[^/]+$")
LINK_RE = re.compile(r"https://[^\s)\]>\"']+")

FIELDS = {
    "mode": "What are you submitting",
    "source_file": "Source file",
    "asset": "Existing document id",
    "version": "Version",
    "locales": "Locales to translate into",
    "template": "Layout template",
    "source_repo": "English source repository",
    "source_path": "Path in that repository",
    "owners": "Document owners",
}


ADD_LANGUAGE_FIELDS = {
    "asset": "Document id",
    "locales": "Languages to add",
}


class FormError(Exception):
    pass


def parse_sections(body: str, fields: Dict[str, str] = FIELDS) -> Dict[str, str]:
    sections: Dict[str, str] = {}
    for block in re.split(r"^### ", body or "", flags=re.MULTILINE)[1:]:
        label, _, value = block.partition("\n")
        value = value.strip()
        if value == "_No response_":
            value = ""
        sections[label.strip()] = value
    out = {}
    for key, prefix in fields.items():
        out[key] = next((v for k, v in sections.items() if k.startswith(prefix)), "")
    return out


def attachment_url(text: str) -> Optional[str]:
    urls = [u for u in LINK_RE.findall(text or "")
            if urlparse(u).hostname in ATTACHMENT_HOSTS and ATTACHMENT_PATH_RE.match(urlparse(u).path)]
    urls = list(dict.fromkeys(urls))
    if len(urls) > 1:
        raise FormError("attach exactly one source file (found several)")
    return urls[0] if urls else None


def build_payload(form: Dict[str, str], author: str) -> Dict[str, str]:
    new_doc = form["mode"].startswith("A new document")
    if not new_doc and not form["mode"].startswith("New locales"):
        raise FormError("choose what you're submitting (new document, or new locales/version)")

    version = form["version"].strip()
    if not VERSION_RE.match(version):
        raise FormError(f"version {version!r} isn't valid (letters, digits, . _ -)")

    payload = {"version": version, "locales": ",".join(split_locales(form["locales"]))}
    url = attachment_url(form["source_file"])

    if new_doc:
        if not url:
            raise FormError("a new document needs its .pdf or .docx dragged into the Source file box")
        filename = unquote(urlparse(url).path.rsplit("/", 1)[-1])
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SPLIT_BY:
            raise FormError(f"source file must be .pdf or .docx, got {filename!r}")
        template = form["template"].strip() or "green-template"
        if template not in TEMPLATES:
            raise FormError(f"unknown template {template!r}")
        payload.update(split_by=SPLIT_BY[ext], template=template)
        owners = [o.strip().lstrip("@") for o in re.split(r"[,\s]+", form["owners"]) if o.strip()] or [author]
        if not all(USER_RE.match(o) for o in owners):
            raise FormError("owners must be GitHub usernames, comma-separated")
        payload["owners"] = ",".join(owners)
        if form["source_repo"]:
            if not REPO_RE.match(form["source_repo"].strip()):
                raise FormError("English source repository must look like owner/repo")
            payload["source_repo"] = form["source_repo"].strip()
        if form["source_path"]:
            if not PATH_RE.match(form["source_path"].strip()) or ".." in form["source_path"]:
                raise FormError("path in that repository isn't valid")
            payload["source_path"] = form["source_path"].strip()
    else:
        asset = form["asset"].strip()
        if not ASSET_RE.match(asset):
            raise FormError("give the existing document id (as listed on the Status page)")
        payload["asset"] = asset

    if url:
        payload["attachment_url"] = url
    return payload


def split_locales(text: str) -> List[str]:
    locales = [l.strip() for l in re.split(r"[,\s]+", text or "") if l.strip()]
    if not locales:
        raise FormError("list at least one locale, e.g. de-DE")
    bad = [l for l in locales if not LOCALE_RE.match(l)]
    if bad:
        raise FormError(f"not BCP-47 locale codes: {', '.join(bad)}")
    return list(dict.fromkeys(locales))


def build_add_language_payload(form: Dict[str, str], registry: Dict) -> Dict[str, str]:
    """An existing document, same version, new locales only."""
    asset = form["asset"].strip()
    if not ASSET_RE.match(asset):
        raise FormError("give the document id (as listed on the Status page)")
    entry = (registry.get("assets") or {}).get(asset)
    if not entry:
        raise FormError(f"no document {asset!r} is registered; new documents use the onboarding form")
    have = set(entry.get("locales") or [])
    new = [l for l in split_locales(form["locales"]) if l not in have]
    if not new:
        raise FormError(f"{asset} already has every language listed")
    return {"asset": asset, "version": str(entry["version"]), "locales": ",".join(new)}


def load_registry() -> Dict:
    import yaml  # only needed on this path
    root = Path(__file__).resolve().parent.parent
    # BaseLoader keeps every value a string, so a version like 2026.10 stays "2026.10".
    return yaml.load((root / "registry.yaml").read_text(), Loader=yaml.BaseLoader) or {}


def main() -> None:
    try:
        if os.environ.get("FORM") == "add-language":
            form = parse_sections(os.environ.get("BODY", ""), ADD_LANGUAGE_FIELDS)
            payload = build_add_language_payload(form, load_registry())
        else:
            payload = build_payload(parse_sections(os.environ.get("BODY", "")), os.environ.get("AUTHOR", ""))
    except FormError as e:
        print(f"::error::Onboarding form: {e}")
        sys.exit(1)
    print("payload:", json.dumps(payload, indent=2))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"payload={json.dumps(payload)}\n")
            # Validated above, so safe as plain outputs (asset is blank for a
            # new document; bootstrap derives it from the file name).
            f.write(f"asset={payload.get('asset', '')}\nlocales={payload['locales']}\n")


if __name__ == "__main__":
    main()
