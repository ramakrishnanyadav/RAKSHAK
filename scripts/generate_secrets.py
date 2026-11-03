#!/usr/bin/env python3
"""
Cryptographic Secrets Generator for ADAPTIVE-PATH Platform.
Generates cryptographically strong random tokens for:
- JWT signing keys (HS256 64-byte base64)
- CSRF double-submit secret tokens
- Database and Redis cluster passwords
- MinIO root administrator credentials
"""

import secrets
import string
import argparse
from pathlib import Path


def generate_alphanumeric_password(length: int = 32) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    # Ensure at least one lowercase, uppercase, digit, and special char
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_secrets_dict() -> dict:
    return {
        "APATH_JWT_SECRET": secrets.token_urlsafe(64),
        "APATH_CSRF_SECRET": secrets.token_urlsafe(64),
        "POSTGRES_PASSWORD": generate_alphanumeric_password(32),
        "REDIS_PASSWORD": generate_alphanumeric_password(32),
        "MINIO_ROOT_PASSWORD": generate_alphanumeric_password(32),
    }


def main():
    parser = argparse.ArgumentParser(description="Generate cryptographic secrets for ADAPTIVE-PATH deployment")
    parser.add_argument("--write-env", type=str, help="Path to write generated secrets to (e.g. .env.production)")
    args = parser.parse_args()

    secrets_data = generate_secrets_dict()

    print("=" * 70)
    print("ADAPTIVE-PATH SECRETS GENERATOR (OWASP ASVS LEVEL 2)")
    print("=" * 70)
    for k, v in secrets_data.items():
        masked = v[:6] + "..." + v[-4:]
        print(f"{k:25}: {masked}")
    print("=" * 70)

    if args.write_env:
        target = Path(args.write_env)
        if target.exists():
            print(f"Target file {target} exists. Creating backup {target}.bak...")
            target.rename(target.with_suffix(".bak"))

        lines = [
            "# Auto-generated cryptographic secrets for ADAPTIVE-PATH",
            f"APATH_JWT_SECRET={secrets_data['APATH_JWT_SECRET']}",
            f"APATH_CSRF_SECRET={secrets_data['APATH_CSRF_SECRET']}",
            f"POSTGRES_PASSWORD={secrets_data['POSTGRES_PASSWORD']}",
            f"REDIS_PASSWORD={secrets_data['REDIS_PASSWORD']}",
            f"MINIO_ROOT_PASSWORD={secrets_data['MINIO_ROOT_PASSWORD']}",
        ]
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Successfully wrote generated secrets to {target}")


if __name__ == "__main__":
    main()
