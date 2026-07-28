"""FastAPI backend: upload, analyze, dashboard plan, insights, chat."""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analyzer import load_dataframe, profile_dataframe
from dashboard_planner import build_plan
from llm import chat as llm_chat
from llm import generate_insights

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("bi.main")

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXT = {".csv", ".xlsx", ".xls", ".xlsm", ".tsv"}
MAX_MB = 50

app = FastAPI(title="BI Dashboard Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory cache: file_id -> {path, filename, profile, plan}
_cache: dict[str, dict] = {}


def _load_cached(file_id: str) -> dict:
    entry = _cache.get(file_id)
    if not entry:
        raise HTTPException(404, "file_id não encontrado. Faça upload novamente.")
    return entry


@app.get("/health")
def health():
    return {
        "ok": True,
        "has_api_key": bool(
            os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        ),
        "cached_files": len(_cache),
    }


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Extensão não suportada: {ext}")
    data = await file.read()
    if len(data) > MAX_MB * 1024 * 1024:
        raise HTTPException(400, f"Arquivo excede {MAX_MB}MB")
    file_id = uuid.uuid4().hex
    path = UPLOAD_DIR / f"{file_id}{ext}"
    path.write_bytes(data)
    _cache[file_id] = {"path": str(path), "filename": file.filename}
    log.info("Upload ok: %s (%d bytes) -> %s", file.filename, len(data), file_id)
    return {"file_id": file_id, "filename": file.filename, "size": len(data)}


@app.post("/analyze/{file_id}")
def analyze(file_id: str):
    entry = _load_cached(file_id)
    try:
        df = load_dataframe(entry["path"])
    except Exception as e:
        log.exception("Falha ao ler arquivo")
        raise HTTPException(400, f"Falha ao ler arquivo: {e}")
    profile = profile_dataframe(df, sample_n=20)
    plan = build_plan(df, profile)
    entry["profile"] = profile
    entry["plan"] = plan
    log.info("Analyze ok: %s rows=%d cols=%d charts=%d",
             file_id, profile["rows"], profile["cols"], len(plan["charts"]))
    return {"profile": profile, "plan": plan}


@app.post("/insights/{file_id}")
def insights(file_id: str):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    try:
        text = generate_insights(entry["profile"], entry["plan"])
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        log.exception("Erro inesperado em /insights")
        raise HTTPException(500, f"Erro inesperado: {e}")
    return {"insights": text}


class ChatBody(BaseModel):
    history: list[dict] = []
    message: str


@app.post("/chat/{file_id}")
def chat_endpoint(file_id: str, body: ChatBody):
    entry = _load_cached(file_id)
    if "profile" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    try:
        reply = llm_chat(entry["profile"], body.history, body.message)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        log.exception("Erro inesperado em /chat")
        raise HTTPException(500, f"Erro inesperado: {e}")
    return {"reply": reply}


if __name__ == "__main__":
    import uvicorn

    log.info("Backend subindo em http://127.0.0.1:8000")
    log.info(
        "API key configurada: %s",
        bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")),
    )
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
