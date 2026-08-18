"""Unit tests for LLM multi-provider chain: retry, fallback, transient detection."""
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("GOOGLE_API_KEY", "test-gemini-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ["LLM_RETRY_BASE_DELAY"] = "0.01"

import llm  # noqa: E402
from google.genai import types  # noqa: E402


def _content(text: str) -> types.Content:
    return types.Content(role="user", parts=[types.Part.from_text(text=text)])


class FakeServerError(Exception):
    def __init__(self, code=503, msg="UNAVAILABLE"):
        self.code = code
        super().__init__(msg)


class FakeAuthError(Exception):
    def __init__(self):
        self.code = 401
        super().__init__("unauthenticated")


def test_is_transient_503():
    from google.genai import errors as ge
    e = ge.ServerError(503, {"message": "UNAVAILABLE"})
    assert llm._is_transient(e) is True


def test_is_transient_401_not():
    from google.genai import errors as ge
    e = ge.ClientError(401, {"message": "unauthenticated"})
    assert llm._is_transient(e) is False


def test_is_transient_timeout_string():
    e = Exception("Connection timeout after 30s")
    assert llm._is_transient(e) is True


def test_groq_transient_503():
    from groq import APIStatusError
    e = APIStatusError("overloaded", response=MagicMock(status_code=503), body={})
    assert llm._groq_is_transient(e) is True


def test_groq_transient_401_not():
    from groq import APIStatusError
    e = APIStatusError("bad key", response=MagicMock(status_code=401), body={})
    assert llm._groq_is_transient(e) is False


def test_call_groq_success_no_gemini():
    with patch("llm._groq_call", return_value="hello from groq") as mg, \
         patch("llm._try_generate") as mgem:
        r = llm._call("sys", [_content("hi")], 100)
        assert r == "hello from groq"
        mg.assert_called_once()
        mgem.assert_not_called()


def test_call_groq_all_fail_falls_to_gemini():
    from google.genai import errors as ge
    groq_err = MagicMock(side_effect=FakeServerError())
    with patch("llm._groq_is_transient", return_value=True), \
         patch("llm._groq_call", side_effect=FakeServerError()), \
         patch("llm._try_generate", return_value="from gemini") as mgem:
        r = llm._call("sys", [_content("hi")], 100)
        assert r == "from gemini"
        mgem.assert_called_once()


def test_call_gemini_success_when_no_groq_key():
    with patch("llm.groq_client", return_value=None), \
         patch("llm._try_generate", return_value="gemini only") as mgem:
        r = llm._call("sys", [_content("hi")], 100)
        assert r == "gemini only"
        assert mgem.call_count == 1


def test_call_all_fail_raises():
    with patch("llm._groq_is_transient", return_value=True), \
         patch("llm._is_transient", return_value=True), \
         patch("llm._groq_call", side_effect=FakeServerError()), \
         patch("llm._try_generate", side_effect=FakeServerError()):
        try:
            llm._call("sys", [_content("hi")], 100)
            assert False, "should have raised"
        except RuntimeError as e:
            assert "Gemini" in str(e) or "sobrecarregado" in str(e) or "falharam" in str(e)


def test_groq_models_chain_has_fallback():
    models = llm._groq_models()
    assert len(models) >= 1
    if len(models) == 2:
        assert models[0] != models[1]


def test_pt_br_enforce_injected_in_groq_messages():
    contents = [_content("teste")]
    msgs = llm._groq_messages("sistema base", contents)
    assert msgs[0]["role"] == "system"
    assert "portugues" in msgs[0]["content"].lower() or "pt-br" in msgs[0]["content"].lower()


def test_iter_groq_stream_yields_content():
    chunk1 = MagicMock()
    chunk1.choices = [MagicMock(delta=MagicMock(content="hello "))]
    chunk2 = MagicMock()
    chunk2.choices = [MagicMock(delta=MagicMock(content="world"))]
    empty = MagicMock()
    empty.choices = [MagicMock(delta=MagicMock(content=None))]
    out = list(llm._iter_groq_stream([chunk1, empty, chunk2]))
    assert out == ["hello ", "world"]
