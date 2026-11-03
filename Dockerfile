# Hardened Production Dockerfile for ADAPTIVE-PATH Studio Backend & Worker
FROM python:3.11-slim AS base

WORKDIR /app

# Install system dependencies (curl for healthchecks, build-essential for C-extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pinned Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source, engine, schemas, and storage
COPY backend /app/backend
COPY engine /app/engine
COPY schemas /app/schemas
COPY storage /app/storage
COPY export_openapi.py /app/export_openapi.py

# Create dedicated non-root system user (CIS Benchmark / OWASP ASVS V14.2)
RUN groupadd -r apath && useradd -r -g apath -u 10001 -m -d /app apath \
    && chown -R apath:apath /app

USER apath

ENV PYTHONPATH=/app
ENV APATH_STORAGE_DIR=/app/storage

EXPOSE 8000

# Docker healthcheck against FastAPI liveness probe
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Default: apply migrations, seed sample runs, and start ASGI server
CMD ["sh", "-c", "python -m alembic -c backend/alembic.ini upgrade head && python -m backend.app.seed && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"]
