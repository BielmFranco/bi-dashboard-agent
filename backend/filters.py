"""Apply user-selected filters to a DataFrame before profiling/planning.

Filter payload shape (JSON from frontend):
    {
        "categoria": {"op": "in", "values": ["Eletrônicos", "Roupas"]},
        "data":      {"op": "range", "min": "2025-01-01", "max": "2025-06-30"},
        "quantidade":{"op": "range", "min": 100, "max": null}
    }

Supported ops:
    - "in"    : values ∈ list
    - "range" : min ≤ value ≤ max (either bound optional)
    - "eq"    : value == single
"""
from __future__ import annotations

import logging
from typing import Any

import pandas as pd

log = logging.getLogger("bi.filters")


def apply_filters(df: pd.DataFrame, filters: dict[str, Any] | None) -> pd.DataFrame:
    if not filters:
        return df
    mask = pd.Series(True, index=df.index)
    for col, spec in filters.items():
        if col not in df.columns:
            log.warning("Filter targets unknown column: %s", col)
            continue
        op = spec.get("op") if isinstance(spec, dict) else None
        if op == "in":
            values = spec.get("values") or []
            if not values:
                continue
            mask &= df[col].isin(values)
        elif op == "range":
            mn, mx = spec.get("min"), spec.get("max")
            series = df[col]
            if pd.api.types.is_numeric_dtype(series):
                if mn is not None:
                    mask &= series >= float(mn)
                if mx is not None:
                    mask &= series <= float(mx)
            else:
                # try datetime range
                try:
                    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True)
                    if mn is not None:
                        mask &= parsed >= pd.to_datetime(mn, dayfirst=True)
                    if mx is not None:
                        mask &= parsed <= pd.to_datetime(mx, dayfirst=True)
                except Exception:
                    log.warning("Range filter failed for %s", col)
        elif op == "eq":
            v = spec.get("value")
            if v is not None:
                mask &= df[col] == v
        else:
            log.warning("Unknown filter op for %s: %s", col, op)
    filtered = df[mask]
    log.info("Filters reduced %d → %d rows", len(df), len(filtered))
    return filtered


def summarize_active(filters: dict[str, Any] | None) -> list[str]:
    """Human-friendly summary of active filters."""
    if not filters:
        return []
    out: list[str] = []
    for col, spec in filters.items():
        op = spec.get("op") if isinstance(spec, dict) else None
        if op == "in":
            vals = spec.get("values") or []
            if vals:
                head = ", ".join(str(v) for v in vals[:3])
                more = f" +{len(vals)-3}" if len(vals) > 3 else ""
                out.append(f"{col} ∈ [{head}{more}]")
        elif op == "range":
            mn, mx = spec.get("min"), spec.get("max")
            if mn is not None and mx is not None:
                out.append(f"{col}: {mn}–{mx}")
            elif mn is not None:
                out.append(f"{col} ≥ {mn}")
            elif mx is not None:
                out.append(f"{col} ≤ {mx}")
        elif op == "eq":
            v = spec.get("value")
            if v is not None:
                out.append(f"{col} = {v}")
    return out
