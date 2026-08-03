"""FastAPI backend: upload, analyze, dashboard plan, insights, chat."""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

import cache as disk_cache
from analyzer import load_dataframe, profile_dataframe
from dashboard_planner import build_plan
from llm import chat as llm_chat
from llm import generate_insights, generate_insights_stream
from pdf_export import render_pdf, PdfExportError

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


# In-memory cache: file_id -> {path, filename, profile, plan, uploaded_at}
# Restored from disk on startup, synced back on every mutation.
_cache: dict[str, dict] = disk_cache.load_all()


def _load_cached(file_id: str) -> dict:
    entry = _cache.get(file_id)
    if not entry:
        raise HTTPException(404, "file_id não encontrado. Faça upload novamente.")
    return entry


def _persist(file_id: str) -> None:
    entry = _cache.get(file_id)
    if entry:
        disk_cache.save(file_id, entry)


@app.get("/health")
def health():
    return {
        "ok": True,
        "has_api_key": bool(
            os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        ),
        "cached_files": len(_cache),
    }


@app.get("/files")
def list_files():
    items = [disk_cache.summary(fid, e) for fid, e in _cache.items()]
    items.sort(key=lambda x: x.get("uploaded_at") or 0, reverse=True)
    return {"files": items}


@app.delete("/files/{file_id}")
def delete_file(file_id: str):
    entry = _cache.pop(file_id, None)
    if not entry:
        raise HTTPException(404, "file_id não encontrado.")
    disk_cache.delete(file_id, entry)
    log.info("File removido: %s (%s)", file_id, entry.get("filename"))
    return {"ok": True}


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
    _persist(file_id)
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
    _persist(file_id)
    log.info("Analyze ok: %s rows=%d cols=%d charts=%d",
             file_id, profile["rows"], profile["cols"], len(plan["charts"]))
    return {"profile": profile, "plan": plan}


@app.get("/analyze/{file_id}")
def get_analysis(file_id: str):
    """Retrieve cached analysis without recomputing — used to restore session."""
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(404, "Análise não encontrada. Rode POST /analyze.")
    return {"profile": entry["profile"], "plan": entry["plan"], "filename": entry.get("filename")}


@app.get("/report_data/{file_id}")
def report_data(file_id: str):
    """Data feed used by the /report/{fileId} Next.js print page."""
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(404, "Análise não encontrada.")
    return {
        "profile": entry["profile"],
        "plan": entry["plan"],
        "filename": entry.get("filename"),
        "insights": entry.get("insights"),
    }


class ExportBody(BaseModel):
    insights: str | None = None
    frontend_url: str | None = None


@app.post("/export/{file_id}")
def export_pdf(file_id: str, body: ExportBody | None = None):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    if body and body.insights:
        entry["insights"] = body.insights
        _persist(file_id)
    frontend = (body.frontend_url if body else None) or os.environ.get(
        "FRONTEND_URL", "http://localhost:3000"
    )
    try:
        pdf_bytes = render_pdf(f"{frontend.rstrip('/')}/report/{file_id}")
    except PdfExportError as e:
        log.exception("PDF export failed")
        raise HTTPException(500, str(e))
    safe_name = (entry.get("filename") or "relatorio").rsplit(".", 1)[0]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}_relatorio.pdf"',
        },
    )


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


def _sse(event: str, data: str) -> str:
    payload = data.replace("\r\n", "\n").replace("\r", "\n")
    lines = "\n".join(f"data: {ln}" for ln in payload.split("\n"))
    return f"event: {event}\n{lines}\n\n"


@app.post("/insights_stream/{file_id}")
def insights_stream(file_id: str):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")

    def gen():
        try:
            for chunk in generate_insights_stream(entry["profile"], entry["plan"]):
                yield _sse("chunk", chunk)
            yield _sse("done", "")
        except RuntimeError as e:
            yield _sse("error", str(e))
        except Exception as e:
            log.exception("Erro inesperado em /insights_stream")
            yield _sse("error", f"Erro inesperado: {e}")

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


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
    log.info("Cache disco: %d arquivos restaurados", len(_cache))
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
