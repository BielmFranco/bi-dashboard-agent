"""Claude Haiku client."""
from __future__ import annotations

import json
import os
from typing import Iterable

from anthropic import Anthropic
from dotenv import load_dotenv

from prompts import CHAT_SYSTEM, INSIGHTS_USER_TEMPLATE, SYSTEM_PROMPT

load_dotenv()

_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY não definida no .env")
        _client = Anthropic(api_key=key)
    return _client


def model_id() -> str:
    return os.environ.get("MODEL_ID", "claude-haiku-4-5-20251001")


def generate_insights(profile: dict, plan: dict, sample_n: int = 20) -> str:
    user = INSIGHTS_USER_TEMPLATE.format(
        profile_json=json.dumps(profile, ensure_ascii=False, default=str)[:60000],
        plan_json=json.dumps(plan, ensure_ascii=False, default=str)[:20000],
        sample_json=json.dumps(profile.get("sample", []), ensure_ascii=False, default=str)[:20000],
        sample_n=sample_n,
    )
    resp = client().messages.create(
        model=model_id(),
        max_tokens=3000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user}],
    )
    return "".join(block.text for block in resp.content if block.type == "text")


def chat(profile: dict, history: Iterable[dict], user_msg: str) -> str:
    ctx = (
        "Contexto da base carregada (perfil resumido):\n"
        + json.dumps(
            {k: v for k, v in profile.items() if k != "sample"},
            ensure_ascii=False,
            default=str,
        )[:30000]
    )
    messages = [{"role": "user", "content": ctx}, {"role": "assistant", "content": "Base carregada. Pode perguntar."}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_msg})
    resp = client().messages.create(
        model=model_id(),
        max_tokens=1500,
        system=CHAT_SYSTEM,
        messages=messages,
    )
    return "".join(block.text for block in resp.content if block.type == "text")
