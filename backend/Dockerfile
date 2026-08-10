# Playwright base image already has Chromium + system deps
FROM mcr.microsoft.com/playwright/python:v1.62.0-jammy

WORKDIR /app

# Install Python deps first (better layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Persist cache + uploads in mountable dirs
RUN mkdir -p /app/cache /app/uploads
VOLUME ["/app/cache", "/app/uploads"]

# Railway injects PORT; default 8000 for local
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV UVICORN_HOST=0.0.0.0

EXPOSE 8000

# Use PORT env var (Railway sets it dynamically)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info
