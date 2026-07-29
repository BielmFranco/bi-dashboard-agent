"""Disk-persisted cache of file metadata.

Stores one JSON per file_id at `cache/{file_id}.json` with:
    { path, filename, uploaded_at, profile?, plan? }

The uploaded raw file itself is on disk in `uploads/{file_id}{ext}`. This
module only persists the metadata + analysis output so a backend restart
does not force the user to re-upload and re-analyze.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

log = logging.getLogger("bi.cache")

BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def _entry_path(file_id: str) -> Path:
    return CACHE_DIR / f"{file_id}.json"


def load_all() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for f in CACHE_DIR.glob("*.json"):
        file_id = f.stem
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            log.warning("Cache corrompido em %s, ignorado", f)
            continue
        raw = data.get("path")
        if not raw or not Path(raw).exists():
            log.info("Arquivo raw sumiu para %s, cache descartado", file_id)
            try:
                f.unlink()
            except OSError:
                pass
            continue
        result[file_id] = data
    log.info("Cache disco carregado: %d entradas", len(result))
    return result


def save(file_id: str, entry: dict[str, Any]) -> None:
    entry.setdefault("uploaded_at", time.time())
    tmp = _entry_path(file_id).with_suffix(".json.tmp")
    tmp.write_text(json.dumps(entry, ensure_ascii=False, default=str), encoding="utf-8")
    tmp.replace(_entry_path(file_id))


def delete(file_id: str, entry: dict[str, Any] | None = None) -> None:
    p = _entry_path(file_id)
    if p.exists():
        try:
            p.unlink()
        except OSError as e:
            log.warning("Falha ao remover cache %s: %s", p, e)
    if entry:
        raw = entry.get("path")
        if raw:
            try:
                Path(raw).unlink(missing_ok=True)
            except OSError as e:
                log.warning("Falha ao remover raw %s: %s", raw, e)


def summary(file_id: str, entry: dict[str, Any]) -> dict[str, Any]:
    prof = entry.get("profile") or {}
    return {
        "file_id": file_id,
        "filename": entry.get("filename"),
        "uploaded_at": entry.get("uploaded_at"),
        "rows": prof.get("rows"),
        "cols": prof.get("cols"),
        "has_profile": bool(entry.get("profile")),
        "has_plan": bool(entry.get("plan")),
    }
