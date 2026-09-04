"""Pandas profiling: types, nulls, stats, correlation, outliers."""
from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd


def _try_parse_dates(sample: pd.Series) -> pd.Series:
    """Parse ambiguous date-like strings without polluting logs.

    Uses `format="mixed"` so pandas parses row-by-row without falling back
    silently to dateutil (which emits UserWarning every call).
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        try:
            return pd.to_datetime(sample, errors="coerce", dayfirst=True, format="mixed")
        except (ValueError, TypeError):
            return pd.to_datetime(sample, errors="coerce", dayfirst=True)


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
    records = df.head(n).to_dict(orient="records")
    return [{k: _safe(v) for k, v in rec.items()} for rec in records]


_ID_NAME_HINTS = ("id", "codigo", "código", "cod", "matricula", "matrícula", "cpf", "cnpj", "registro")


def _looks_like_id(name: str, series: pd.Series) -> bool:
    """Detect identifier columns conservatively.

    Rule: name must match an ID hint token. Cardinality alone is too
    ambiguous — a unique-per-row numeric column may be a measurement
    (age, salary, cost) rather than an identifier. Falsely classifying
    a metric as ID silently removes it from KPIs and charts.
    """
    non_null = series.dropna()
    if non_null.empty:
        return False
    name_low = name.lower().strip()
    name_hit = any(
        h == name_low
        or name_low.endswith("_" + h)
        or name_low.startswith(h + "_")
        or h in name_low.split()
        or name_low.endswith(h)
        for h in _ID_NAME_HINTS
    )
    if not name_hit:
        return False
    unique_ratio = non_null.nunique() / len(non_null)
    return unique_ratio >= 0.6


def _infer_semantic(series: pd.Series, name: str = "") -> str:
    if series.dropna().empty:
        return "empty"
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
        return "empty"
    # Check ID before categorical: a matricula/cpf/codigo column can have
    # low nunique on tiny samples but is still an identifier by intent.
    if _looks_like_id(name, non_null):
        return "id"
    # Check datetime_like BEFORE categorical. A date column stored as text
    # usually has few distinct values (e.g. 12 months, or one row per day over
    # a short span) and would otherwise be trapped as "categorical", which
    # removes it from the time-series chart in dashboard_planner. Requiring
    # >80% of a 50-row sample to parse as a date keeps real categoricals
    # (names, product codes, months-as-words) out of this branch.
    sample = non_null.astype(str).head(50)
    try:
        parsed = _try_parse_dates(sample)
        if parsed.notna().mean() > 0.8:
            return "datetime_like"
    except Exception:
        pass
    nunique = non_null.nunique()
    if nunique <= max(20, int(0.05 * len(non_null))):
        return "categorical"
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
        parsed = s if semantic == "datetime" else _try_parse_dates(s.astype(str))
        prof["min_date"] = _safe(parsed.min())
        prof["max_date"] = _safe(parsed.max())
    return prof


def _group_summaries(
    df: pd.DataFrame,
    columns: list[dict],
    max_dims: int = 4,
    max_groups: int = 15,
    max_metrics: int = 4,
) -> list[dict]:
    """Per-group aggregates so the LLM can answer 'which X has the highest Y'.

    The column profile only carries whole-column stats (sum/mean of the whole
    column), so questions like 'qual produto tem maior média' had no numbers to
    stand on and the model correctly refused. This computes, for each
    low-cardinality categorical dimension, the count plus sum and mean of each
    numeric metric per group. Kept compact (few dims, top groups, few metrics)
    to not blow up the prompt.
    """
    cats = [
        c["name"] for c in columns
        if c["semantic"] in ("categorical", "boolean") and c.get("unique", 0) <= 20
    ][:max_dims]
    nums = [c["name"] for c in columns if c["semantic"] == "numeric"][:max_metrics]
    if not cats or not nums:
        return []
    out: list[dict] = []
    for cat in cats:
        try:
            grp = df.groupby(cat, dropna=True)
            sizes = grp.size().sort_values(ascending=False).head(max_groups)
            agg = grp[nums].agg(["sum", "mean"])
            groups = []
            for val in sizes.index:
                rec: dict = {"value": str(_safe(val)), "count": int(sizes[val])}
                for n in nums:
                    rec[n] = {
                        "sum": _safe(agg.loc[val, (n, "sum")]),
                        "mean": _safe(agg.loc[val, (n, "mean")]),
                    }
                groups.append(rec)
            out.append({"dimension": cat, "metrics": nums, "groups": groups})
        except Exception:
            continue
    return out


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
        "group_summaries": _group_summaries(df, columns),
        "sample": _clean_records(df, sample_n),
        "sample_size": min(sample_n, len(df)),
    }


def load_dataframe(path: str) -> pd.DataFrame:
    lower = path.lower()
    if lower.endswith(".csv"):
        first_ok: pd.DataFrame | None = None
        for enc in ("utf-8", "latin-1", "cp1252"):
            for sep in (",", ";", "\t", "|"):
                try:
                    df = pd.read_csv(path, sep=sep, encoding=enc)
                except Exception:
                    continue
                if df.shape[1] > 1:
                    return df
                if first_ok is None and df.shape[1] == 1 and df.shape[0] > 0:
                    first_ok = df
        if first_ok is not None:
            return first_ok
        raise ValueError(f"Não foi possível decodificar CSV: {path}")
    if lower.endswith((".xlsx", ".xls", ".xlsm")):
        return pd.read_excel(path)
    if lower.endswith(".tsv"):
        return pd.read_csv(path, sep="\t")
    raise ValueError(f"Formato não suportado: {path}")
