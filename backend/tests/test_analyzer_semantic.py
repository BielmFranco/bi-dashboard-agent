"""Tests for date-column detection and per-group summaries in the profiler."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("GOOGLE_API_KEY", "test")
os.environ.setdefault("GROQ_API_KEY", "test")

import pandas as pd  # noqa: E402

from analyzer import _infer_semantic, profile_dataframe  # noqa: E402
from dashboard_planner import build_plan  # noqa: E402


# ---- date detection (bug: text dates trapped as categorical) ----

def test_string_dates_low_cardinality_are_datetime_like():
    # 20 rows, 10 distinct dates: previously classified as categorical.
    s = pd.Series([f"2025-{m:02d}-{d:02d}" for m, d in zip(range(1, 11), range(1, 21, 2))] * 2)[:20]
    assert _infer_semantic(s, "data") == "datetime_like"


def test_string_dates_monthly_repeated_are_datetime_like():
    # 5000 rows, only 12 distinct month-starts.
    s = pd.Series([f"2025-{(i % 12) + 1:02d}-01" for i in range(5000)])
    assert _infer_semantic(s, "data") == "datetime_like"


def test_word_months_stay_categorical():
    s = pd.Series(["janeiro", "fevereiro", "marco"] * 10)
    assert _infer_semantic(s, "mes") == "categorical"


def test_product_names_stay_categorical():
    s = pd.Series(["A", "B", "C"] * 10)
    assert _infer_semantic(s, "produto") == "categorical"


def test_datetime_dtype_still_datetime():
    s = pd.to_datetime(pd.Series([f"2025-{(i % 12) + 1:02d}-01" for i in range(100)]))
    assert _infer_semantic(s, "data") == "datetime"


def test_date_column_produces_time_series_chart():
    # End-to-end: a text date column must yield a "line" chart in the plan.
    df = pd.DataFrame({
        "data": [f"2025-{m:02d}-15" for m in range(1, 13)],
        "receita": [100 * m for m in range(1, 13)],
    })
    prof = profile_dataframe(df, sample_n=5)
    plan = build_plan(df, prof)
    assert any(c["type"] == "line" for c in plan["charts"]), \
        f"expected a line chart, got {[c['type'] for c in plan['charts']]}"


# ---- group summaries (bug: chat could not answer per-group aggregation) ----

SALES = pd.DataFrame({
    "produto": ["A", "B", "A", "B", "A", "B"],
    "quantidade": [100, 80, 120, 90, 150, 110],
    "valor": [10, 40, 20, 30, 30, 50],
})


def test_group_summaries_present():
    prof = profile_dataframe(SALES, sample_n=6)
    gs = prof.get("group_summaries")
    assert gs, "group_summaries should be populated for a categorical + numeric frame"
    dims = {g["dimension"] for g in gs}
    assert "produto" in dims


def test_group_summaries_mean_is_correct():
    prof = profile_dataframe(SALES, sample_n=6)
    produto = next(g for g in prof["group_summaries"] if g["dimension"] == "produto")
    a = next(grp for grp in produto["groups"] if grp["value"] == "A")
    b = next(grp for grp in produto["groups"] if grp["value"] == "B")
    # A: quantidade 100,120,150 -> mean 123.33; B: 80,90,110 -> mean 93.33
    assert round(a["quantidade"]["mean"], 2) == 123.33
    assert round(b["quantidade"]["mean"], 2) == 93.33
    # valor: A mean (10+20+30)/3=20 ; B mean (40+30+50)/3=40
    assert a["valor"]["mean"] == 20
    assert b["valor"]["mean"] == 40


def test_group_summaries_empty_without_categorical():
    df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
    prof = profile_dataframe(df, sample_n=3)
    assert prof.get("group_summaries") == []
