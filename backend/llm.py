"""Claude Haiku client."""
from __future__ import annotations

import json
import logging
import os
from typing import Iterable

from anthropic import (
    Anthropic,
    APIConnectionError,
    APIStatusError,
    AuthenticationError,
    RateLimitError,
)
from dotenv import load_dotenv

from prompts import CHAT_SYSTEM, INSIGHTS_USER_TEMPLATE, SYSTEM_PROMPT

load_dotenv()

log = logging.getLogger("bi.llm")

_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY não definida. Crie backend/.env com a key.",
            )
        _client = Anthropic(api_key=key, timeout=120.0, max_retries=1)
    return _client


def model_id() -> str:
    return os.environ.get("MODEL_ID", "claude-haiku-4-5-20251001")


def _call(system: str, messages: list[dict], max_tokens: int) -> str:
    try:
        resp = client().messages.create(
            model=model_id(),
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return "".join(b.text for b in resp.content if b.type == "text")
    except AuthenticationError as e:
        log.error("Anthropic auth error: %s", e)
        raise RuntimeError("Key inválida ou sem créditos. Verifique ANTHROPIC_API_KEY.")
    except RateLimitError as e:
        log.error("Anthropic rate limit: %s", e)
        raise RuntimeError("Rate limit da Anthropic atingido. Aguarde e tente novamente.")
    except APIConnectionError as e:
        log.error("Anthropic connection error: %s", e)
        raise RuntimeError("Falha de conexão com Anthropic. Verifique internet/proxy.")
    except APIStatusError as e:
        log.error("Anthropic API error %s: %s", e.status_code, e.message)
        msg = str(e.message or "")
        if "credit balance" in msg.lower() or "insufficient" in msg.lower():
            raise RuntimeError(
                "Sem créditos na conta Anthropic. Adicione em "
                "https://console.anthropic.com/settings/billing"
            )
        if e.status_code == 400:
            raise RuntimeError(f"Requisição inválida à Anthropic: {msg}")
        if e.status_code == 403:
            raise RuntimeError("Acesso negado. Key sem permissão para este modelo.")
        raise RuntimeError(f"Erro Anthropic {e.status_code}: {msg}")
    except Exception as e:
        log.exception("Unexpected LLM error")
        raise RuntimeError(f"Erro inesperado no Claude: {e}")


def generate_insights(profile: dict, plan: dict, sample_n: int = 20) -> str:
    profile_slim = {k: v for k, v in profile.items() if k != "sample"}
    user = INSIGHTS_USER_TEMPLATE.format(
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
    log.info("Insights request: model=%s user_chars=%d", model_id(), len(user))
    return _call(SYSTEM_PROMPT, [{"role": "user", "content": user}], max_tokens=3000)


def chat(profile: dict, history: Iterable[dict], user_msg: str) -> str:
    slim = {k: v for k, v in profile.items() if k != "sample"}
    ctx = "Contexto da base carregada (perfil resumido):\n" + json.dumps(
        slim, ensure_ascii=False, default=str
    )[:20000]
    messages: list[dict] = [
        {"role": "user", "content": ctx},
        {"role": "assistant", "content": "Base carregada. Pode perguntar."},
    ]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_msg})
    log.info("Chat request: history=%d msg_chars=%d", len(list(history)), len(user_msg))
    return _call(CHAT_SYSTEM, messages, max_tokens=1500)
