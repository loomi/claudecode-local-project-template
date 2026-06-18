#!/usr/bin/env bash
# End-of-turn verification. Lint + typecheck + build for both subprojects.
# Fast-fail; intended to be run by the Claude Code Stop hook so the user
# always gets a project that boots after a vibe-coding session.

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\033[1;36m[verify]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[verify]\033[0m %s\n' "$*" >&2; exit 1; }

if [ ! -d back-end/node_modules ] || [ ! -d front-end/node_modules ]; then
  log "node_modules missing — run 'make setup' first"
  exit 0
fi

log "back-end: lint"
( cd back-end && npm run lint --silent ) || fail "back-end lint failed"

log "back-end: build"
( cd back-end && npm run build --silent ) || fail "back-end build failed"

log "front-end: typecheck"
( cd front-end && npm run typecheck --silent ) || fail "front-end typecheck failed"

log "all green"
