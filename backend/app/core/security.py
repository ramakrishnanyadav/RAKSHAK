"""
Security and Cryptography Service.
Implements Argon2id password hashing, rotating JWT access/refresh tokens,
CSRF double-submit token verification, and secure random token generation.
"""

import hmac
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from backend.app.config import settings
from backend.app.core.errors import AuthenticationError, CSRFError

# Argon2id password hasher tuned for OWASP ASVS recommendations
_pwd_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    type=Type.ID,
)


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _pwd_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash with timing attack resistance."""
    try:
        return _pwd_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_token(raw_token: str) -> str:
    """SHA-256 hash of random tokens stored in database to protect against DB leaks."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate cryptographically secure URL-safe random string."""
    return secrets.token_urlsafe(nbytes)


def create_access_token(
    user_id: str,
    role: str,
    session_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate short-lived JWT access token.
    Payload: sub (user_id), role, session_id, iat, exp, type="access".
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))

    payload = {
        "sub": user_id,
        "role": role,
        "session_id": session_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate JWT access token signature and expiration.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "access":
            raise AuthenticationError("Invalid token type", code="TOKEN_INVALID_TYPE")
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Access token has expired", code="TOKEN_EXPIRED")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(f"Invalid access token: {str(e)}", code="TOKEN_INVALID")


def generate_csrf_token() -> str:
    """Generate cryptographically secure CSRF token."""
    return secrets.token_hex(32)


def verify_csrf_token(cookie_token: Optional[str], header_token: Optional[str]) -> bool:
    """
    Double-submit CSRF verification using constant-time comparison.
    """
    if not cookie_token or not header_token:
        return False
    return secrets.compare_digest(cookie_token, header_token)
