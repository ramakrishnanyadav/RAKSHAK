"""
FastAPI Middleware & Global Exception Handlers.
Injects correlation request IDs, structured access logging, OWASP security headers,
and formats all errors consistently as:
{ "code": str, "message": str, "details": dict, "request_id": str }
"""

import os
import time
import uuid
import logging
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.config import settings
from backend.app.core.errors import AppException
from backend.app.core.security import verify_csrf_token

logger = logging.getLogger("studio.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s")


class ObservabilityAndSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Request ID correlation
        request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id

        # 2. CSRF Verification for Cookie-Authenticated Mutating Requests
        # If client uses cookie-based auth without Bearer header, enforce CSRF
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            exempt_paths = {
                "/api/auth/login",
                "/api/auth/register",
                "/api/auth/guest",
                "/api/auth/refresh",
                "/api/auth/forgot-password",
                "/api/auth/reset-password",
                "/api/auth/verify-email",
            }
            auth_header = request.headers.get("Authorization", "")
            # Only enforce CSRF if authenticated via session cookie without Bearer header
            if not auth_header and request.cookies.get("access_token") and request.url.path not in exempt_paths:
                cookie_csrf = request.cookies.get("csrf_token")
                header_csrf = request.headers.get("X-CSRF-Token")
                if not verify_csrf_token(cookie_csrf, header_csrf):
                    return JSONResponse(
                        status_code=403,
                        content={
                            "code": "CSRF_VERIFICATION_FAILED",
                            "message": "Missing or invalid CSRF token in X-CSRF-Token header.",
                            "details": {},
                            "request_id": request_id,
                        },
                    )

        # 3. Execution & Timing
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            # Let global exception handlers format the error response
            raise exc

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 4. Inject Correlation & Comprehensive OWASP ASVS V14 Security Headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; "
            "object-src 'none'; base-uri 'self';"
        )
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"

        # Structured Log Output
        client_ip = request.client.host if request.client else "unknown"
        if settings.environment == "production" or os.getenv("APATH_LOG_FORMAT") == "json":
            import json
            from datetime import datetime, timezone
            log_payload = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": client_ip,
            }
            logger.info(json.dumps(log_payload))
        else:
            logger.info(
                f"request_id={request_id} method={request.method} path={request.url.path} "
                f"status={response.status_code} duration_ms={duration_ms} client_ip={client_ip}"
            )

        return response


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom exception handlers enforcing consistent error response format."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            headers=exc.headers,
            content={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": request_id,
            },
        )

    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(request: Request, exc: FileNotFoundError):
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=404,
            content={
                "code": "NOT_FOUND",
                "message": str(exc),
                "details": {},
                "request_id": request_id,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", None)
        # Simplify validation error list
        errors = [
            {"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload structure.",
                "details": {"errors": errors},
                "request_id": request_id,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None)
        logger.exception(f"Unhandled exception on request {request_id}: {str(exc)}")
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred. Please contact system support.",
                "details": {},
                "request_id": request_id,
            },
        )
