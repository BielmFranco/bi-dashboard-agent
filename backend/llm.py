"""Multi-provider LLM client: Groq primary → Gemini fallback."""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Iterable, Iterator

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

try:
    from groq import Groq, APIStatusError as GroqAPIError, APIConnectionError as GroqConnErr
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False
    Groq = None  # type: ignore
    GroqAPIError = Exception  # type: ignore
    GroqConnErr = Exception  # type: ignore

from prompts import CHAT_SYSTEM, INSIGHTS_USER_TEMPLATE, SYSTEM_PROMPT

load_dotenv()

log = logging.getLogger("bi.llm")

MAX_RETRIES = int(os.environ.get("LLM_MAX_RETRIES", "3"))
RETRY_BASE_DELAY = float(os.environ.get("LLM_RETRY_BASE_DELAY", "1.5"))

GROQ_MODEL = os.environ.get("GROQ_MODEL_ID", "openai/gpt-oss-20b")
GROQ_FALLBACK_MODEL = os.environ.get("GROQ_FALLBACK_MODEL_ID", "openai/gpt-oss-120b")

PT_BR_ENFORCE = (
    "\n\nIMPORTANTE: Responda SEMPRE e EXCLUSIVAMENTE em português brasileiro (pt-BR). "
    "Nunca use inglês, mesmo em títulos, cabeçalhos ou termos técnicos comuns."
)


def fallback_model_id() -> str | None:
    v = os.environ.get("FALLBACK_MODEL_ID", "gemini-flash-lite-latest").strip()
    return v or None


_groq_client: "Groq | None" = None
_groq_key: str | None = None


def groq_client() -> "Groq | None":
    global _groq_client, _groq_key
    if not _GROQ_AVAILABLE:
        return None
    load_dotenv(override=True)
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    if _groq_client is None or _groq_key != key:
        _groq_client = Groq(api_key=key)
        _groq_key = key
    return _groq_client


def _groq_messages(system: str, contents: list[types.Content]) -> list[dict]:
    """Convert Gemini-style Contents to OpenAI-compat messages for Groq."""
    msgs: list[dict] = [{"role": "system", "content": system + PT_BR_ENFORCE}]
    for c in contents:
        role = "assistant" if c.role == "model" else "user"
        text = "".join(getattr(p, "text", "") or "" for p in c.parts)
        msgs.append({"role": role, "content": text})
    return msgs


def _groq_is_transient(e: Exception) -> bool:
    if isinstance(e, GroqConnErr):
        return True
    if isinstance(e, GroqAPIError):
        status = getattr(e, "status_code", None)
        if status in (500, 502, 503, 504, 408, 429):
            return True
    msg = str(e).lower()
    return any(k in msg for k in ("timeout", "temporarily", "unavailable"))


def _groq_models() -> list[str]:
    models = [GROQ_MODEL]
    if GROQ_FALLBACK_MODEL and GROQ_FALLBACK_MODEL != GROQ_MODEL:
        models.append(GROQ_FALLBACK_MODEL)
    return models


def _groq_call(system: str, contents: list[types.Content], max_tokens: int, model: str) -> str:
    c = groq_client()
    if not c:
        raise RuntimeError("Groq indisponível (SDK ou GROQ_API_KEY faltando)")
    resp = c.chat.completions.create(
        model=model,
        messages=_groq_messages(system, contents),
        max_tokens=max_tokens,
        temperature=0.4,
    )
    return resp.choices[0].message.content or ""


def _groq_stream(system: str, contents: list[types.Content], max_tokens: int, model: str):
    c = groq_client()
    if not c:
        raise RuntimeError("Groq indisponível (SDK ou GROQ_API_KEY faltando)")
    return c.chat.completions.create(
        model=model,
        messages=_groq_messages(system, contents),
        max_tokens=max_tokens,
        temperature=0.4,
        stream=True,
    )


def _is_transient(e: Exception) -> bool:
    """503 / UNAVAILABLE / server / timeout — safe to retry."""
    if isinstance(e, (genai_errors.ServerError,)):
        return True
    if isinstance(e, genai_errors.ClientError):
        status = getattr(e, "code", None)
        if status in (500, 502, 503, 504):
            return True
        msg = str(e).lower()
        if "unavailable" in msg or "overloaded" in msg or "high demand" in msg:
            return True
        return False
    msg = str(e).lower()
    return any(k in msg for k in ("timeout", "temporarily", "connection reset"))

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


def _base_config(system: str, max_tokens: int) -> types.GenerateContentConfig:
    """Config shared by sync + stream calls.

    `max_output_tokens` must budget both:
      - `thinking` tokens (Gemini 2.5+ silently consumes them for chain-of-thought)
      - visible response tokens
    Gemini flash uses ~2500-3000 tokens on thinking, so budget stays generous.
    Setting `thinking_budget=0` is rejected by gemini-flash-latest (400 INVALID_ARGUMENT).
    """
    return types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=max_tokens,
        temperature=0.4,
    )


def _try_generate(model: str, system: str, contents: list[types.Content], max_tokens: int) -> str:
    resp = client().models.generate_content(
        model=model,
        contents=contents,
        config=_base_config(system, max_tokens),
    )
    text = resp.text or ""
    if not text:
        log.warning("Gemini retornou resposta vazia. Candidates: %s", resp.candidates)
    return text


def _call(system: str, contents: list[types.Content], max_tokens: int) -> str:
    """Try Groq primary → Gemini fallback chain, with retries per model."""
    last_exc: Exception | None = None

    # Provider 1: Groq chain (if key present)
    if groq_client() is not None:
        gmodels = _groq_models()
        groq_exhausted = False
        for gm_idx, gm in enumerate(gmodels):
            if groq_exhausted:
                break
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    if gm_idx > 0 or attempt > 1:
                        log.info("Groq retry model=%s attempt=%d/%d", gm, attempt, MAX_RETRIES)
                    return _groq_call(system, contents, max_tokens, gm)
                except Exception as e:
                    last_exc = e
                    if _groq_is_transient(e) and attempt < MAX_RETRIES:
                        delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                        log.warning("Groq transient %s — retry in %.1fs", type(e).__name__, delay)
                        time.sleep(delay)
                        continue
                    if gm_idx < len(gmodels) - 1:
                        log.warning("Groq %s failed (%s), trying %s", gm, e, gmodels[gm_idx + 1])
                        break
                    log.warning("Groq chain exhausted (%s), falling back to Gemini", e)
                    groq_exhausted = True
                    break

    # Provider 2: Gemini chain
    primary = model_id()
    fallback = fallback_model_id()
    models = [primary]
    if fallback and fallback != primary:
        models.append(fallback)

    for m_idx, m in enumerate(models):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                if m_idx > 0 or attempt > 1:
                    log.info("Gemini retry model=%s attempt=%d/%d", m, attempt, MAX_RETRIES)
                return _try_generate(m, system, contents, max_tokens)
            except Exception as e:
                last_exc = e
                if _is_transient(e) and attempt < MAX_RETRIES:
                    delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    log.warning("Gemini transient %s — retry in %.1fs", type(e).__name__, delay)
                    time.sleep(delay)
                    continue
                if _is_transient(e) and m_idx < len(models) - 1:
                    log.warning("Gemini %s exhausted, trying %s", m, models[m_idx + 1])
                    break
                raise _translate_error(e)
    raise _translate_error(last_exc or RuntimeError("Todos os providers falharam"))


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
    return _call(SYSTEM_PROMPT, [_text_content("user", user)], max_tokens=8000)


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
        code = getattr(e, "code", None)
        if code == 503 or "unavailable" in str(e).lower() or "overloaded" in str(e).lower():
            return RuntimeError(
                "Gemini sobrecarregado no momento. Já tentamos automaticamente algumas vezes "
                "e mudamos pra modelo secundário. Aguarde ~30s e tente novamente."
            )
        return RuntimeError(f"Erro no servidor Gemini: {e}")
    if isinstance(e, genai_errors.APIError):
        return RuntimeError(f"Erro Gemini: {e}")
    return RuntimeError(f"Erro inesperado no Gemini: {e}")


def _iter_groq_stream(stream) -> Iterator[str]:
    for chunk in stream:
        try:
            delta = chunk.choices[0].delta.content
        except (AttributeError, IndexError):
            continue
        if delta:
            yield delta


def _iter_gemini_stream(stream) -> Iterator[str]:
    for chunk in stream:
        text = getattr(chunk, "text", None)
        if text:
            yield text


def _open_stream(model: str, system: str, contents: list[types.Content], max_tokens: int) -> Iterator[str]:
    """Try Groq → Gemini chain. Returns unified text-chunk iterator."""
    last_exc: Exception | None = None

    # Provider 1: Groq chain
    if groq_client() is not None:
        gmodels = _groq_models()
        groq_exhausted = False
        for gm_idx, gm in enumerate(gmodels):
            if groq_exhausted:
                break
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    if gm_idx > 0 or attempt > 1:
                        log.info("Groq stream retry model=%s attempt=%d/%d", gm, attempt, MAX_RETRIES)
                    s = _groq_stream(system, contents, max_tokens, gm)
                    return _iter_groq_stream(s)
                except Exception as e:
                    last_exc = e
                    if _groq_is_transient(e) and attempt < MAX_RETRIES:
                        delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                        log.warning("Groq stream transient %s — retry in %.1fs", type(e).__name__, delay)
                        time.sleep(delay)
                        continue
                    if gm_idx < len(gmodels) - 1:
                        log.warning("Groq stream %s failed (%s), trying %s", gm, e, gmodels[gm_idx + 1])
                        break
                    log.warning("Groq stream chain exhausted (%s), falling back to Gemini", e)
                    groq_exhausted = True
                    break

    # Provider 2: Gemini chain
    primary = model
    fallback = fallback_model_id()
    models = [primary]
    if fallback and fallback != primary:
        models.append(fallback)

    for m_idx, m in enumerate(models):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                if m_idx > 0 or attempt > 1:
                    log.info("Gemini stream retry model=%s attempt=%d/%d", m, attempt, MAX_RETRIES)
                s = client().models.generate_content_stream(
                    model=m,
                    contents=contents,
                    config=_base_config(system, max_tokens),
                )
                return _iter_gemini_stream(s)
            except Exception as e:
                last_exc = e
                if _is_transient(e) and attempt < MAX_RETRIES:
                    delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
                    log.warning("Gemini stream transient %s — retry in %.1fs", type(e).__name__, delay)
                    time.sleep(delay)
                    continue
                if _is_transient(e) and m_idx < len(models) - 1:
                    log.warning("Gemini stream %s exhausted, trying %s", m, models[m_idx + 1])
                    break
                raise _translate_error(e)
    raise _translate_error(last_exc or RuntimeError("Todos os providers falharam"))


def generate_insights_stream(profile: dict, plan: dict, sample_n: int = 20) -> Iterator[str]:
    """Yields text chunks as Gemini generates them."""
    user = _build_insights_prompt(profile, plan, sample_n)
    log.info("Insights stream request: model=%s user_chars=%d", model_id(), len(user))
    stream = _open_stream(model_id(), SYSTEM_PROMPT, [_text_content("user", user)], max_tokens=8000)
    try:
        for text in stream:
            if text:
                yield text
    except Exception as e:
        log.exception("Stream mid-flight error")
        raise _translate_error(e)


def _chat_contents(profile: dict, history: Iterable[dict], user_msg: str) -> list[types.Content]:
    slim = {k: v for k, v in profile.items() if k != "sample"}
    ctx = "Contexto da base carregada (perfil resumido):\n" + json.dumps(
        slim, ensure_ascii=False, default=str
    )[:20000]
    contents: list[types.Content] = [
        _text_content("user", ctx),
        _text_content("assistant", "Base carregada. Pode perguntar."),
    ]
    for h in history:
        contents.append(_text_content(h["role"], h["content"]))
    contents.append(_text_content("user", user_msg))
    return contents


def chat(profile: dict, history: Iterable[dict], user_msg: str) -> str:
    hist = list(history)
    contents = _chat_contents(profile, hist, user_msg)
    log.info("Chat request: history=%d msg_chars=%d", len(hist), len(user_msg))
    return _call(CHAT_SYSTEM, contents, max_tokens=4000)


def chat_stream(profile: dict, history: Iterable[dict], user_msg: str) -> Iterator[str]:
    """SSE-friendly streaming variant of chat()."""
    hist = list(history)
    contents = _chat_contents(profile, hist, user_msg)
    log.info("Chat stream request: history=%d msg_chars=%d", len(hist), len(user_msg))
    stream = _open_stream(model_id(), CHAT_SYSTEM, contents, max_tokens=4000)
    try:
        for text in stream:
            if text:
                yield text
    except Exception as e:
        log.exception("Chat stream mid-flight error")
        raise _translate_error(e)


def suggest_questions(profile: dict) -> list[str]:
    """Ask Gemini for 4 short questions in pt-BR based on the profile.
    Returns a plain list of strings."""
    slim = {k: v for k, v in profile.items() if k != "sample"}
    profile_json = json.dumps(slim, ensure_ascii=False, default=str)[:15000]
    prompt = (
        "Com base no perfil de dados abaixo, gere EXATAMENTE 4 perguntas curtas "
        "(máximo 6 palavras cada) que um analista faria sobre essa base. "
        "Foque no que os dados permitem responder (colunas presentes, tipos). "
        "Não repita perguntas óbvias. Responda SÓ as 4 perguntas, uma por linha, "
        "sem numeração, sem aspas, sem marcadores.\n\n"
        f"PERFIL:\n{profile_json}"
    )
    system = "Você sugere perguntas de análise de dados em pt-BR. Curtas, objetivas, específicas ao dataset."
    try:
        text = _call(system, [_text_content("user", prompt)], max_tokens=1000)
    except RuntimeError:
        raise
    except Exception as e:
        raise _translate_error(e)
    lines = [ln.strip().lstrip("-•* ").rstrip("?.") for ln in text.split("\n") if ln.strip()]
    lines = [ln + "?" for ln in lines if ln]
    return lines[:4]
