"""Rules-based dashboard planner: KPIs and chart selection from column profiles."""
from __future__ import annotations

from typing import Any

import pandas as pd

from analyzer import _safe


def _numeric_cols(profile: dict) -> list[dict]:
    return [c for c in profile["columns"] if c["semantic"] == "numeric"]


def _categorical_cols(profile: dict) -> list[dict]:
    return [c for c in profile["columns"] if c["semantic"] in ("categorical", "boolean")]


def _date_cols(profile: dict) -> list[dict]:
    return [c for c in profile["columns"] if c["semantic"] in ("datetime", "datetime_like")]


def _build_kpis(profile: dict) -> list[dict]:
    kpis: list[dict] = [{
        "id": "rows",
        "label": "Total de Registros",
        "value": profile["rows"],
        "format": "int",
    }]
    for c in _numeric_cols(profile)[:4]:
        kpis.append({
            "id": f"sum_{c['name']}",
            "label": f"Soma de {c['name']}",
            "value": c.get("sum"),
            "format": "num",
        })
        kpis.append({
            "id": f"mean_{c['name']}",
            "label": f"Média de {c['name']}",
            "value": c.get("mean"),
            "format": "num",
        })
    return kpis[:8]


def _agg_by(df: pd.DataFrame, dim: str, metric: str, agg: str = "sum", top: int = 12) -> list[dict]:
    g = df.groupby(dim, dropna=True)[metric]
    series = g.agg(agg) if agg != "count" else g.count()
    series = series.sort_values(ascending=False).head(top)
    return [
        {"label": str(_safe(k)), "value": _safe(v)}
        for k, v in series.items()
    ]


def _time_series(df: pd.DataFrame, date_col: str, metric: str, freq: str = "ME") -> list[dict]:
    s = df[[date_col, metric]].copy()
    s[date_col] = pd.to_datetime(s[date_col], errors="coerce", dayfirst=True)
    s = s.dropna(subset=[date_col])
    g = s.groupby(pd.Grouper(key=date_col, freq=freq))[metric].sum().dropna()
    return [
        {"label": _safe(k), "value": _safe(v)}
        for k, v in g.items()
    ]


def _distribution(df: pd.DataFrame, col: str, bins: int = 12) -> list[dict]:
    s = pd.to_numeric(df[col], errors="coerce").dropna()
    if s.empty:
        return []
    binned = pd.cut(s, bins=bins, include_lowest=True)
    counts = binned.value_counts().sort_index()
    return [
        {"label": f"{i.left:.2f}–{i.right:.2f}", "value": int(v)}
        for i, v in counts.items()
    ]


def _pie(df: pd.DataFrame, dim: str, top: int = 8) -> list[dict]:
    vc = df[dim].value_counts(dropna=True).head(top)
    return [{"label": str(_safe(k)), "value": int(v)} for k, v in vc.items()]


def build_plan(df: pd.DataFrame, profile: dict) -> dict:
    charts: list[dict] = []

    num_cols = _numeric_cols(profile)
    cat_cols = _categorical_cols(profile)
    date_cols = _date_cols(profile)

    if date_cols and num_cols:
        dc = date_cols[0]["name"]
        nc = num_cols[0]["name"]
        charts.append({
            "id": f"ts_{nc}",
            "type": "line",
            "title": f"Evolução Mensal — {nc}",
            "rationale": "Existem colunas de data e métricas numéricas — série temporal revela tendências e sazonalidade.",
            "x_label": dc,
            "y_label": nc,
            "data": _time_series(df, dc, nc, freq="ME"),
        })

    if cat_cols and num_cols:
        for cat in cat_cols[:2]:
            nc = num_cols[0]["name"]
            charts.append({
                "id": f"bar_{cat['name']}_{nc}",
                "type": "bar",
                "title": f"Top {cat['name']} por {nc}",
                "rationale": "Ranking categórico revela contribuintes principais para a métrica.",
                "x_label": cat["name"],
                "y_label": nc,
                "data": _agg_by(df, cat["name"], nc, agg="sum", top=10),
            })

    if cat_cols:
        cat = cat_cols[0]
        charts.append({
            "id": f"pie_{cat['name']}",
            "type": "pie",
            "title": f"Participação — {cat['name']}",
            "rationale": "Distribuição percentual entre categorias mostra concentração.",
            "data": _pie(df, cat["name"], top=8),
        })

    if num_cols:
        nc = num_cols[0]["name"]
        charts.append({
            "id": f"hist_{nc}",
            "type": "bar",
            "title": f"Distribuição — {nc}",
            "rationale": "Histograma revela forma da distribuição, assimetria e caudas.",
            "x_label": "faixa",
            "y_label": "frequência",
            "data": _distribution(df, nc, bins=12),
        })

    if len(num_cols) >= 2:
        a, b = num_cols[0]["name"], num_cols[1]["name"]
        s = df[[a, b]].dropna().head(500)
        charts.append({
            "id": f"scatter_{a}_{b}",
            "type": "scatter",
            "title": f"Dispersão — {a} vs {b}",
            "rationale": "Duas métricas numéricas — dispersão revela correlação e outliers.",
            "x_label": a,
            "y_label": b,
            "data": [{"x": _safe(x), "y": _safe(y)} for x, y in zip(s[a], s[b])],
        })

    return {
        "kpis": _build_kpis(profile),
        "charts": charts,
        "filters_suggested": [c["name"] for c in cat_cols[:3]] + [c["name"] for c in date_cols[:1]],
    }
