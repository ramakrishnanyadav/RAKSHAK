#!/usr/bin/env bash
# =====================================================================
# One-Command Offline Demo Launcher for Linux & macOS
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "${DIR}/start_demo.py"
