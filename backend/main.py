"""FastAPI backend: upload, analyze, dashboard plan, insights, chat."""
import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import pandas as pd

import cache as disk_cache
from analyzer import load_dataframe, profile_dataframe
from dashboard_planner import build_plan
from filters import apply_filters, summarize_active
from llm import chat as llm_chat
from llm import chat_stream as llm_chat_stream
from llm import generate_insights, generate_insights_stream, suggest_questions
from pdf_export import render_pdf, PdfExportError


def _client_ip(request: Request) -> str:
    """Real client IP behind Cloudflare Tunnel / proxy chain."""
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_client_ip)

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for k in ("file_id", "endpoint", "ip", "duration_ms"):
            v = getattr(record, k, None)
            if v is not None:
                payload[k] = v
        return json.dumps(payload, ensure_ascii=False)


_LOG_FMT = os.environ.get("LOG_FORMAT", "text").lower()
_handler = logging.StreamHandler()
if _LOG_FMT == "json":
    _handler.setFormatter(JsonFormatter())
else:
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))

logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
log = logging.getLogger("bi.main")

APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
_START_TS = time.time()

BASE_DIR = Path(__file__).parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXT = {".csv", ".xlsx", ".xls", ".xlsm", ".tsv"}
MAX_MB = 50

app = FastAPI(title="BI Dashboard Agent", version=APP_VERSION)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error at %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Erro interno. Tente novamente ou contate o mantenedor."},
    )

# CORS: default allows local dev. Add prod origin via FRONTEND_URL env var.
_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_extra = os.environ.get("FRONTEND_URL")
_allowed = _default_origins + ([_extra.rstrip("/")] if _extra else [])
# Optional wildcard for Vercel preview deploys: FRONTEND_URL_REGEX
_allow_regex = os.environ.get("FRONTEND_URL_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    allow_origin_regex=_allow_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory cache: file_id -> {path, filename, profile, plan, uploaded_at}
# Restored from disk on startup, synced back on every mutation.
_cache: dict[str, dict] = disk_cache.load_all()

RETENTION_DAYS = int(os.environ.get("CACHE_RETENTION_DAYS", "7"))


@app.on_event("startup")
async def _startup_cleanup():
    removed = disk_cache.cleanup_older_than(RETENTION_DAYS)
    if removed:
        # Reload in-memory cache after cleanup
        _cache.clear()
        _cache.update(disk_cache.load_all())

    async def _periodic():
        import asyncio
        while True:
            await asyncio.sleep(6 * 3600)  # every 6h
            r = disk_cache.cleanup_older_than(RETENTION_DAYS)
            if r:
                _cache.clear()
                _cache.update(disk_cache.load_all())

    import asyncio
    asyncio.create_task(_periodic())


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
    du = shutil.disk_usage(str(BASE_DIR))
    return {
        "ok": True,
        "version": APP_VERSION,
        "uptime_s": int(time.time() - _START_TS),
        "has_api_key": bool(
            os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        ),
        "model": os.environ.get("MODEL_ID", "gemini-flash-latest"),
        "cached_files": len(_cache),
        "retention_days": RETENTION_DAYS,
        "disk_free_gb": round(du.free / 1024**3, 2),
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
@limiter.limit("20/minute")
async def upload(request: Request, file: UploadFile = File(...)):
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
@limiter.limit("30/minute")
def analyze(request: Request, file_id: str):
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


class FilteredBody(BaseModel):
    filters: dict = {}


class DrillBody(BaseModel):
    column: str
    value: str | int | float | None = None
    op: str = "eq"
    filters: dict = {}
    limit: int = 200


@app.post("/analyze/{file_id}/filtered")
@limiter.limit("30/minute")
def analyze_filtered(request: Request, file_id: str, body: FilteredBody):
    entry = _load_cached(file_id)
    try:
        df = load_dataframe(entry["path"])
    except Exception as e:
        raise HTTPException(400, f"Falha ao ler arquivo: {e}")
    filtered = apply_filters(df, body.filters)
    if filtered.empty:
        raise HTTPException(400, "Filtros resultaram em 0 registros. Ajuste os critérios.")
    profile = profile_dataframe(filtered, sample_n=20)
    plan = build_plan(filtered, profile)
    profile["active_filters"] = summarize_active(body.filters)
    log.info("Filtered analyze: %s → %d rows (filters=%s)",
             file_id, len(filtered), list((body.filters or {}).keys()))
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
@limiter.limit("5/minute")
def export_pdf(request: Request, file_id: str, body: ExportBody | None = None):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    if body and body.insights:
        entry["insights"] = body.insights
        _persist(file_id)
    frontend = (body.frontend_url if body else None) or os.environ.get(
        "FRONTEND_URL", "http://localhost:3000"
    )
    report_url = f"{frontend.rstrip('/')}/report/{file_id}?api=http://127.0.0.1:8000"
    try:
        pdf_bytes = render_pdf(report_url)
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


@app.post("/drill/{file_id}")
@limiter.limit("30/minute")
def drill(request: Request, file_id: str, body: DrillBody):
    entry = _load_cached(file_id)
    try:
        df = load_dataframe(entry["path"])
    except Exception as e:
        raise HTTPException(400, f"Falha ao ler arquivo: {e}")
    df = apply_filters(df, body.filters)
    col = body.column
    if col not in df.columns:
        raise HTTPException(400, f"Coluna '{col}' não existe")
    if body.op == "eq":
        try:
            if pd.api.types.is_numeric_dtype(df[col]):
                subset = df[df[col] == float(body.value)]
            else:
                subset = df[df[col].astype(str) == str(body.value)]
        except Exception:
            subset = df[df[col].astype(str) == str(body.value)]
    else:
        subset = df
    subset = subset.head(body.limit)
    # Return columns + rows in JSON-safe form
    from analyzer import _safe
    rows = []
    for _, r in subset.iterrows():
        rows.append({k: _safe(v) for k, v in r.items()})
    return {
        "column": col,
        "value": body.value,
        "total": int(len(rows)),
        "columns": list(df.columns),
        "rows": rows,
    }


class InsightsBody(BaseModel):
    filters: dict = {}


def _plan_for_context(entry: dict, filters: dict | None):
    """Return (profile, plan) tuple, recomputing both if filters active."""
    base_profile = entry.get("profile") or {}
    base_plan = entry.get("plan") or {}
    if not filters:
        return base_profile, base_plan
    try:
        df = load_dataframe(entry["path"])
    except Exception as e:
        log.warning("Falha ao recomputar plano filtrado: %s. Usando base.", e)
        return base_profile, base_plan
    filtered = apply_filters(df, filters)
    if filtered.empty:
        log.warning("Filtros zeraram o dataframe, usando plano base.")
        return base_profile, base_plan
    prof = profile_dataframe(filtered, sample_n=20)
    prof["active_filters"] = summarize_active(filters)
    plan = build_plan(filtered, prof)
    return prof, plan


@app.post("/insights/{file_id}")
@limiter.limit("10/minute")
def insights(request: Request, file_id: str, body: InsightsBody | None = None):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    filters = body.filters if body else {}
    profile, plan = _plan_for_context(entry, filters)
    try:
        text = generate_insights(profile, plan)
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
@limiter.limit("10/minute")
def insights_stream(request: Request, file_id: str, body: InsightsBody | None = None):
    entry = _load_cached(file_id)
    if "profile" not in entry or "plan" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    filters = body.filters if body else {}
    profile, plan = _plan_for_context(entry, filters)

    def gen():
        try:
            for chunk in generate_insights_stream(profile, plan):
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
    filters: dict = {}


def _profile_for_context(entry: dict, filters: dict | None) -> dict:
    """Return filtered profile if filters active, else full base profile."""
    base = entry.get("profile") or {}
    if not filters:
        return base
    try:
        df = load_dataframe(entry["path"])
    except Exception as e:
        log.warning("Falha ao recomputar perfil filtrado: %s. Usando perfil base.", e)
        return base
    filtered = apply_filters(df, filters)
    if filtered.empty:
        log.warning("Filtros zeraram o dataframe, usando perfil base.")
        return base
    prof = profile_dataframe(filtered, sample_n=20)
    prof["active_filters"] = summarize_active(filters)
    return prof


@app.post("/chat/{file_id}")
@limiter.limit("10/minute")
def chat_endpoint(request: Request, file_id: str, body: ChatBody):
    entry = _load_cached(file_id)
    if "profile" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    profile = _profile_for_context(entry, body.filters)
    try:
        reply = llm_chat(profile, body.history, body.message)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        log.exception("Erro inesperado em /chat")
        raise HTTPException(500, f"Erro inesperado: {e}")
    return {"reply": reply}


@app.post("/chat_stream/{file_id}")
@limiter.limit("10/minute")
def chat_stream_endpoint(request: Request, file_id: str, body: ChatBody):
    entry = _load_cached(file_id)
    if "profile" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    profile = _profile_for_context(entry, body.filters)

    def gen():
        try:
            for chunk in llm_chat_stream(profile, body.history, body.message):
                yield _sse("chunk", chunk)
            yield _sse("done", "")
        except RuntimeError as e:
            yield _sse("error", str(e))
        except Exception as e:
            log.exception("Erro inesperado em /chat_stream")
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


@app.get("/suggestions/{file_id}")
@limiter.limit("20/minute")
def suggestions_endpoint(request: Request, file_id: str):
    entry = _load_cached(file_id)
    if "profile" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    try:
        qs = suggest_questions(entry["profile"])
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        log.exception("Erro em /suggestions")
        raise HTTPException(500, f"Erro inesperado: {e}")
    return {"suggestions": qs}


class SuggestionsBody(BaseModel):
    filters: dict = {}


@app.post("/suggestions/{file_id}")
@limiter.limit("20/minute")
def suggestions_post(request: Request, file_id: str, body: SuggestionsBody):
    """POST variant that accepts active filters — recomputes profile if any."""
    entry = _load_cached(file_id)
    if "profile" not in entry:
        raise HTTPException(400, "Rode /analyze antes.")
    profile = _profile_for_context(entry, body.filters)
    try:
        qs = suggest_questions(profile)
    except RuntimeError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        log.exception("Erro em /suggestions POST")
        raise HTTPException(500, f"Erro inesperado: {e}")
    return {"suggestions": qs}


if __name__ == "__main__":
    import uvicorn

    log.info("Backend subindo em http://127.0.0.1:8000")
    log.info(
        "API key configurada: %s",
        bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")),
    )
    log.info("Cache disco: %d arquivos restaurados", len(_cache))
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
