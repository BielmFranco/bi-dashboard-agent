"""Google Gemini 2.0 Flash client."""
from __future__ import annotations

import json
import logging
import os
from typing import Iterable, Iterator

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from prompts import CHAT_SYSTEM, INSIGHTS_USER_TEMPLATE, SYSTEM_PROMPT

load_dotenv()

log = logging.getLogger("bi.llm")

_client: genai.Client | None = None
_client_key: str | None = None


def client() -> genai.Client:
    global _client, _client_key
    load_dotenv(override=True)
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise RuntimeError(
            "GOOGLE_API_KEY não definida. Crie backend/.env com sua key do Google AI Studio.",
        )
    if _client is None or _client_key != key:
        _client = genai.Client(api_key=key)
        _client_key = key
    return _client


def model_id() -> str:
    return os.environ.get("MODEL_ID", "gemini-2.0-flash")


def _call(system: str, contents: list[types.Content], max_tokens: int) -> str:
    try:
        resp = client().models.generate_content(
            model=model_id(),
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                temperature=0.4,
            ),
        )
        text = resp.text or ""
        if not text:
            log.warning("Gemini retornou resposta vazia. Candidates: %s", resp.candidates)
        return text
    except genai_errors.ClientError as e:
        status = getattr(e, "code", None)
        msg = str(e)
        log.error("Gemini client error %s: %s", status, msg)
        low = msg.lower()
        if status == 401 or "api key" in low or "unauthenticated" in low:
            raise RuntimeError(
                "Key inválida. Verifique GOOGLE_API_KEY em backend/.env. "
                "Pegue uma em https://aistudio.google.com/apikey",
            )
        if status == 429 or "quota" in low or "rate" in low:
            raise RuntimeError(
                "Quota Gemini atingida (1500 req/dia no free tier). Aguarde ou faça upgrade.",
            )
        if status == 400:
            raise RuntimeError(f"Requisição inválida ao Gemini: {msg}")
        if status == 403:
            raise RuntimeError("Acesso negado. Key sem permissão para este modelo.")
        raise RuntimeError(f"Erro Gemini {status}: {msg}")
    except genai_errors.ServerError as e:
        log.error("Gemini server error: %s", e)
        raise RuntimeError(f"Erro no servidor Gemini: {e}")
    except genai_errors.APIError as e:
        log.error("Gemini API error: %s", e)
        raise RuntimeError(f"Erro Gemini: {e}")
    except Exception as e:
        log.exception("Unexpected LLM error")
        raise RuntimeError(f"Erro inesperado no Gemini: {e}")


def _text_content(role: str, text: str) -> types.Content:
    # Gemini uses "user" and "model" roles.
    gem_role = "model" if role == "assistant" else "user"
    return types.Content(role=gem_role, parts=[types.Part.from_text(text=text)])


def _build_insights_prompt(profile: dict, plan: dict, sample_n: int = 20) -> str:
    profile_slim = {k: v for k, v in profile.items() if k != "sample"}
    return INSIGHTS_USER_TEMPLATE.format(
        profile_json=json.dumps(profile_slim, ensure_ascii=False, default=str)[:40000],
        plan_json=json.dumps(
            {
                "kpis": plan.get("kpis", []),
                "charts": [
                    {k: v for k, v in c.items() if k != "data"}
                    for c in plan.get("charts", [])
                ],
                "filters_suggested": plan.get("filters_suggested", []),
            },
            ensure_ascii=False,
            default=str,
        )[:10000],
        sample_json=json.dumps(profile.get("sample", []), ensure_ascii=False, default=str)[:15000],
        sample_n=sample_n,
    )


def generate_insights(profile: dict, plan: dict, sample_n: int = 20) -> str:
    user = _build_insights_prompt(profile, plan, sample_n)
    log.info("Insights request: model=%s user_chars=%d", model_id(), len(user))
    return _call(SYSTEM_PROMPT, [_text_content("user", user)], max_tokens=3000)


def _translate_error(e: Exception) -> RuntimeError:
    if isinstance(e, genai_errors.ClientError):
        status = getattr(e, "code", None)
        msg = str(e)
        low = msg.lower()
        if status == 401 or "api key" in low or "unauthenticated" in low:
            return RuntimeError(
                "Key inválida. Verifique GOOGLE_API_KEY em backend/.env. "
                "Pegue uma em https://aistudio.google.com/apikey",
            )
        if status == 429 or "quota" in low or "rate" in low:
            return RuntimeError(
                "Quota Gemini atingida (1500 req/dia no free tier). Aguarde ou faça upgrade.",
            )
        if status == 400:
            return RuntimeError(f"Requisição inválida ao Gemini: {msg}")
        if status == 403:
            return RuntimeError("Acesso negado. Key sem permissão para este modelo.")
        return RuntimeError(f"Erro Gemini {status}: {msg}")
    if isinstance(e, genai_errors.ServerError):
        return RuntimeError(f"Erro no servidor Gemini: {e}")
    if isinstance(e, genai_errors.APIError):
        return RuntimeError(f"Erro Gemini: {e}")
    return RuntimeError(f"Erro inesperado no Gemini: {e}")


def generate_insights_stream(profile: dict, plan: dict, sample_n: int = 20) -> Iterator[str]:
    """Yields text chunks as Gemini generates them."""
    user = _build_insights_prompt(profile, plan, sample_n)
    log.info("Insights stream request: model=%s user_chars=%d", model_id(), len(user))
    try:
        stream = client().models.generate_content_stream(
            model=model_id(),
            contents=[_text_content("user", user)],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=3000,
                temperature=0.4,
            ),
        )
        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text
    except Exception as e:
        log.exception("Stream error")
        raise _translate_error(e)


def chat(profile: dict, history: Iterable[dict], user_msg: str) -> str:
    hist = list(history)
    slim = {k: v for k, v in profile.items() if k != "sample"}
    ctx = "Contexto da base carregada (perfil resumido):\n" + json.dumps(
        slim, ensure_ascii=False, default=str
    )[:20000]
    contents: list[types.Content] = [
        _text_content("user", ctx),
        _text_content("assistant", "Base carregada. Pode perguntar."),
    ]
    for h in hist:
        contents.append(_text_content(h["role"], h["content"]))
    contents.append(_text_content("user", user_msg))
    log.info("Chat request: history=%d msg_chars=%d", len(hist), len(user_msg))
    return _call(CHAT_SYSTEM, contents, max_tokens=1500)
