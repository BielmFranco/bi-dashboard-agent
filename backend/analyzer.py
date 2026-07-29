"""Pandas profiling: types, nulls, stats, correlation, outliers."""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def _safe(v: Any) -> Any:
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(v, (pd.Timestamp, np.datetime64)):
        try:
            return pd.Timestamp(v).isoformat()
        except Exception:
            return str(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if pd.isna(v):
        return None
    return v


def _clean_records(df: pd.DataFrame, n: int) -> list[dict]:
    head = df.head(n).copy()
    for c in head.columns:
        head[c] = head[c].map(_safe)
    return head.to_dict(orient="records")


_ID_NAME_HINTS = ("id", "codigo", "código", "cod", "matricula", "matrícula", "cpf", "cnpj", "registro")


def _looks_like_id(name: str, series: pd.Series) -> bool:
    non_null = series.dropna()
    if non_null.empty:
        return False
    unique_ratio = non_null.nunique() / len(non_null)
    name_low = name.lower().strip()
    name_hit = any(h == name_low or name_low.endswith("_" + h) or name_low.startswith(h + "_") or h in name_low.split() for h in _ID_NAME_HINTS)
    if unique_ratio >= 0.95:
        return True
    if name_hit and unique_ratio >= 0.5:
        return True
    return False


def _infer_semantic(series: pd.Series, name: str = "") -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        if _looks_like_id(name, series):
            return "id"
        return "numeric"
    non_null = series.dropna()
    if non_null.empty:
        return "unknown"
    nunique = non_null.nunique()
    if nunique <= max(20, int(0.05 * len(non_null))):
        return "categorical"
    sample = non_null.astype(str).head(50)
    try:
        parsed = pd.to_datetime(sample, errors="coerce", dayfirst=True)
        if parsed.notna().mean() > 0.8:
            return "datetime_like"
    except Exception:
        pass
    if _looks_like_id(name, non_null):
        return "id"
    return "text"


def _column_profile(name: str, s: pd.Series) -> dict:
    semantic = _infer_semantic(s, name)
    total = len(s)
    nulls = int(s.isna().sum())
    prof: dict[str, Any] = {
        "name": name,
        "dtype": str(s.dtype),
        "semantic": semantic,
        "n": total,
        "nulls": nulls,
        "null_pct": round(nulls / total * 100, 2) if total else 0.0,
        "unique": int(s.nunique(dropna=True)),
    }
    if semantic == "numeric":
        desc = s.describe()
        prof.update({
            "min": _safe(desc.get("min")),
            "max": _safe(desc.get("max")),
            "mean": _safe(desc.get("mean")),
            "median": _safe(s.median()),
            "std": _safe(desc.get("std")),
            "q25": _safe(desc.get("25%")),
            "q75": _safe(desc.get("75%")),
            "sum": _safe(s.sum()),
        })
        q1, q3 = s.quantile(0.25), s.quantile(0.75)
        iqr = q3 - q1
        if iqr and not math.isnan(iqr):
            low, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            prof["outliers_count"] = int(((s < low) | (s > high)).sum())
        else:
            prof["outliers_count"] = 0
    elif semantic in ("categorical", "text", "boolean"):
        vc = s.value_counts(dropna=True).head(10)
        prof["top_values"] = [
            {"value": _safe(k), "count": int(v)} for k, v in vc.items()
        ]
    elif semantic in ("datetime", "datetime_like"):
        parsed = s if semantic == "datetime" else pd.to_datetime(s, errors="coerce", dayfirst=True)
        prof["min_date"] = _safe(parsed.min())
        prof["max_date"] = _safe(parsed.max())
    return prof


def profile_dataframe(df: pd.DataFrame, sample_n: int = 20) -> dict:
    columns = [_column_profile(c, df[c]) for c in df.columns]

    numeric_cols = [c["name"] for c in columns if c["semantic"] == "numeric"]
    corr = None
    if len(numeric_cols) >= 2:
        cm = df[numeric_cols].corr(numeric_only=True).round(3)
        corr = {
            "columns": numeric_cols,
            "matrix": [[_safe(v) for v in row] for row in cm.values.tolist()],
        }

    dup_count = int(df.duplicated().sum())
    empty_cols = [c for c in df.columns if df[c].isna().all()]

    return {
        "rows": int(len(df)),
        "cols": int(df.shape[1]),
        "columns": columns,
        "duplicates": dup_count,
        "empty_columns": empty_cols,
        "correlation": corr,
        "sample": _clean_records(df, sample_n),
        "sample_size": min(sample_n, len(df)),
    }


def load_dataframe(path: str) -> pd.DataFrame:
    lower = path.lower()
    if lower.endswith(".csv"):
        for sep in [",", ";", "\t", "|"]:
            try:
                df = pd.read_csv(path, sep=sep, encoding="utf-8")
                if df.shape[1] > 1:
                    return df
            except Exception:
                continue
        return pd.read_csv(path, encoding="latin-1", sep=None, engine="python")
    if lower.endswith((".xlsx", ".xls", ".xlsm")):
        return pd.read_excel(path)
    if lower.endswith(".tsv"):
        return pd.read_csv(path, sep="\t")
    raise ValueError(f"Formato não suportado: {path}")
