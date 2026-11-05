#!/usr/bin/env bash
# Khoi dong CAI API + Web Dashboard trong WSL/Linux.
# Chi lang nghe tren loopback (127.0.0.1) — KHONG mo ra Internet/LAN.
set -euo pipefail
cd "$(dirname "$0")"

# 1. Tu dong nap .env tu cai/.env hoac ../.env neu co.
#    Bo ky tu CR (CRLF cua Windows) truoc khi source de tranh loi
#    "$'\r': command not found" lam chet script duoi 'set -e'.
_load_env() { [ -f "$1" ] && { set -a; . <(sed 's/\r$//' "$1"); set +a; }; }
if [ -f ".env" ]; then
    _load_env ".env"
elif [ -f "../.env" ]; then
    _load_env "../.env"
fi

export CAI_API_HOST="${CAI_API_HOST:-0.0.0.0}"
export CAI_API_PORT="${CAI_API_PORT:-8000}"
export CAI_API_SERVE_UI="${CAI_API_SERVE_UI:-true}"
export CAI_API_MODE="true"
export CAI_YOLO="1"
export CAI_GUARDRAILS="false"
export CAI_SENSITIVE_GUARD="false"
export CAI_FETCH_ALLOW_INTERNAL="true"
export CAI_LICENSE_OFF="1"
export PROMPT_TOOLKIT_NO_CPR="1"

# Dam bao cac cong cu pentest (Go/pipx/Rust) nam tren PATH cho agent CAI
# (login shell non-interactive khong doc .bashrc).
export PATH="$HOME/.local/bin:$HOME/go/bin:$HOME/.cargo/bin:$PATH"

VENV="${CAI_VENV:-$HOME/.cai_env}"
PY="$VENV/bin/python"

if [ ! -x "$PY" ]; then
  echo "[!] Khong tim thay venv tai $VENV"
  echo "    Chay cai dat truoc:  bash install_cai_linux.sh"
  echo "    Hoac:  uv pip install --python $PY -e ."
  exit 1
fi

echo "[*] CAI dashboard: http://${CAI_API_HOST}:${CAI_API_PORT}/ui"
echo "[*] Ctrl+C de dung."
exec "$PY" -c "from cai.api.server import run_api_server; run_api_server()"
