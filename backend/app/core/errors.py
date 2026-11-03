"""
Consistent API Error Handling & Error Definitions.
Format: { "code": str, "message": str, "details": dict, "request_id": str }
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable explanation of the error")
    details: Dict[str, Any] = Field(default_factory=dict, description="Detailed context or validation errors")
    request_id: Optional[str] = Field(None, description="Correlation ID for tracing")


class AppException(HTTPException):
    """Base application exception following consistent error format."""

    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "BAD_REQUEST",
        message: str = "Bad Request",
        details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message
        self.details = details or {}


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed", code: str = "AUTH_FAILED", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=code,
            message=message,
            details=details,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionDeniedError(AppException):
    def __init__(self, message: str = "Access denied", code: str = "FORBIDDEN", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code=code,
            message=message,
            details=details,
        )


class ResourceNotFoundError(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code=code,
            message=message,
            details=details,
        )


class ConflictError(AppException):
    def __init__(self, message: str = "Resource conflict", code: str = "CONFLICT", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code=code,
            message=message,
            details=details,
        )


class QuotaExceededError(AppException):
    def __init__(self, message: str = "Quota limit exceeded", code: str = "QUOTA_EXCEEDED", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code=code,
            message=message,
            details=details,
        )


class AccountLockedError(AppException):
    def __init__(self, message: str = "Account temporarily locked due to failed attempts", lock_time_s: int = 300):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="ACCOUNT_LOCKED",
            message=message,
            details={"lock_duration_seconds": lock_time_s},
        )


class CSRFError(AppException):
    def __init__(self, message: str = "CSRF verification failed"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="CSRF_INVALID",
            message=message,
        )
