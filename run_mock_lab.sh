#!/usr/bin/env bash
# CAI_LO Mock Vulnerable Web Lab Runner for Linux / Kali
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="$DIR/src"
PORT="${CAI_MOCK_LAB_PORT:-8888}"
HOST="${CAI_MOCK_LAB_HOST:-0.0.0.0}"

echo "=================================================================="
echo "      Acme Corp Security Portal — Mock Pentest Lab"
echo "=================================================================="
echo "[*] Lab URL: http://127.0.0.1:${PORT}"
echo "[*] Listening on: ${HOST}:${PORT}"
echo "=================================================================="

if [ -f "$DIR/cai_env/bin/python" ]; then
    "$DIR/cai_env/bin/python" -c "from cai.lab.server import run_mock_lab_server; run_mock_lab_server(host='${HOST}', port=${PORT})"
else
    python3 -c "from cai.lab.server import run_mock_lab_server; run_mock_lab_server(host='${HOST}', port=${PORT})"
fi

