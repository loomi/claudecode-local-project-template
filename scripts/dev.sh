#!/usr/bin/env bash
# Run back-end and front-end in parallel. Ctrl-C kills both.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

cleanup() {
  trap - INT TERM EXIT
  [ -n "${BACK_PID:-}" ] && kill "$BACK_PID" 2>/dev/null || true
  [ -n "${FRONT_PID:-}" ] && kill "$FRONT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

( cd back-end && npm run start:dev ) &
BACK_PID=$!
( cd front-end && npm run dev ) &
FRONT_PID=$!

echo "[dev] back-end PID=$BACK_PID  front-end PID=$FRONT_PID"
echo "[dev] back: http://localhost:3001/api   docs: http://localhost:3001/docs"
echo "[dev] front: http://localhost:3000"
wait
