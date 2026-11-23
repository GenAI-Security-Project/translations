"""Resolve which LLM provider/model to use for a given asset.

translate-draft.yml MUST NOT hardcode a model/provider anywhere in its own
YAML or scripts — every invocation resolves it through this module from
tooling/translation-config.yaml, so the LLM can be changed (or a specific
asset pinned to a specific model) without touching the workflow.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

import yaml

CONFIG_PATH = Path(__file__).resolve().parent / "translation-config.yaml"


@dataclass(frozen=True)
class Engine:
    provider: str
    model: str
    # Tried in order when `model` is unavailable (overloaded / rate-limited)
    # -- currently only honoured by the google provider. The model that
    # actually produced a translation is what gets recorded per section.
    fallback_models: Tuple[str, ...] = ()

    @property
    def label(self) -> str:
        """The `provider:model` string recorded in status.json's `translator` field."""
        return f"{self.provider}:{self.model}"


def resolve_engine(asset: str, config_path: Path = CONFIG_PATH) -> Engine:
    config = yaml.safe_load(config_path.read_text()) or {}
    overrides = config.get("overrides") or {}
    entry = overrides.get(asset) or config.get("default")
    if not entry or "provider" not in entry or "model" not in entry:
        raise SystemExit(
            f"{config_path} has no usable `default` (and no override for '{asset}')."
        )
    return Engine(
        provider=entry["provider"],
        model=entry["model"],
        fallback_models=tuple(entry.get("fallback_models") or ()),
    )


if __name__ == "__main__":
    import sys

    asset = sys.argv[1] if len(sys.argv) > 1 else "default"
    print(resolve_engine(asset).label)
