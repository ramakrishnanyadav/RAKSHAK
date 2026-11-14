"""
ADAPTIVE-PATH Studio Backend API (FastAPI).
Unified entrypoint featuring single authorization layer, Argon2id security,
HTTP Range log streaming, resilient job queueing, and comprehensive observability.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.core.middleware import (
    ObservabilityAndSecurityMiddleware,
    register_exception_handlers,
)
from backend.app.routers import (
    auth,
    runs,
    logs,
    scenarios,
    benchmarks,
    failures,
    reports,
    settings as user_settings,
    admin,
    health,
    matlab,
)

# Ensure tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Research & simulation platform for risk-aware predictive path planning on unstructured Indian roads.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# 1. Custom Exception Handlers for consistent {code, message, details, request_id} format
register_exception_handlers(app)

# 2. Observability & Security Middleware (Request IDs, structured access log, CSRF, ASVS headers)
app.add_middleware(ObservabilityAndSecurityMiddleware)

# 3. CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Content-Range", "Accept-Ranges"],
)

# 4. Include Routers
@app.get("/", tags=["root"])
def root_endpoint():
    return {
        "name": "RAKSHAK: ADAPTIVE-PATH 2.0 Backend API",
        "status": "online",
        "version": settings.app_version,
        "docs_url": "/docs",
        "health_check": "/health",
        "message": "Backend service is live and ready for simulation workloads."
    }


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(runs.router)
app.include_router(logs.router)
app.include_router(scenarios.router)
app.include_router(benchmarks.router)

# Backwards compatibility alias for /api/benchmark
@app.get("/api/benchmark", tags=["benchmarks-alias"])
def benchmark_alias(scenario_id: str = None, split: str = "tune", db = Depends(benchmarks.get_db)):
    return benchmarks.get_benchmarks(scenario_id=scenario_id, split=split, db=db)
app.include_router(failures.router)
app.include_router(reports.router)
app.include_router(user_settings.router)
app.include_router(admin.router)
app.include_router(matlab.router)
