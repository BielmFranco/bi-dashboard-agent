"""Tests for filter-aware profile recomputation (fixes chat hallucination bug)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("GOOGLE_API_KEY", "test")
os.environ.setdefault("GROQ_API_KEY", "test")

import pandas as pd  # noqa: E402
from analyzer import profile_dataframe  # noqa: E402
from filters import apply_filters, summarize_active  # noqa: E402


SAMPLE = pd.DataFrame({
    "mes": ["janeiro", "janeiro", "fevereiro", "fevereiro", "marco", "marco"],
    "produto": ["A", "B", "A", "B", "A", "B"],
    "quantidade": [100, 80, 120, 90, 150, 110],
    "valor": [5000, 6400, 6000, 7200, 7500, 8800],
})


def test_no_filter_returns_full_stats():
    prof = profile_dataframe(SAMPLE, sample_n=10)
    qty = next(c for c in prof["columns"] if c["name"] == "quantidade")
    assert qty["sum"] == 650
    assert prof["rows"] == 6


def test_filter_in_reduces_rows():
    filtered = apply_filters(SAMPLE, {"mes": {"op": "in", "values": ["janeiro", "fevereiro"]}})
    assert len(filtered) == 4
    prof = profile_dataframe(filtered, sample_n=10)
    qty = next(c for c in prof["columns"] if c["name"] == "quantidade")
    assert qty["sum"] == 390
    val = next(c for c in prof["columns"] if c["name"] == "valor")
    assert val["sum"] == 24600


def test_filter_range():
    # 100, 120, 110 all within [100, 130]
    filtered = apply_filters(SAMPLE, {"quantidade": {"op": "range", "min": 100, "max": 130}})
    assert len(filtered) == 3
    filtered_narrow = apply_filters(SAMPLE, {"quantidade": {"op": "range", "min": 140, "max": 200}})
    assert len(filtered_narrow) == 1  # só o 150


def test_summarize_active_produces_readable_strings():
    labels = summarize_active({"mes": {"op": "in", "values": ["janeiro"]}})
    assert isinstance(labels, list)
    assert any("mes" in s for s in labels)


def test_empty_filter_dict_returns_all():
    filtered = apply_filters(SAMPLE, {})
    assert len(filtered) == len(SAMPLE)
