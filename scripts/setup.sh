#!/usr/bin/env bash
# Cross-platform (macOS / Linux) bootstrap. Idempotent — re-run anytime.
#
# Detects OS, ensures Node 20+ and npm are present (installing via the native
# package manager if not), then installs deps for back-end and front-end,
# copies .env files, and runs the first Prisma migration against SQLite.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\033[1;36m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2; exit 1; }

OS_KIND="unknown"
case "$(uname -s)" in
  Darwin) OS_KIND="macos" ;;
  Linux)  OS_KIND="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS_KIND="windows-bash" ;;
esac
log "OS: $OS_KIND"

NODE_MIN_MAJOR=20

have() { command -v "$1" >/dev/null 2>&1; }

node_major() {
  if have node; then
    node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

install_node_macos() {
  if have brew; then
    log "installing Node 20 via Homebrew"
    brew install node@20
    brew link --overwrite --force node@20 || true
  else
    die "Homebrew not found. Install from https://brew.sh and rerun, or install Node 20+ manually."
  fi
}

install_node_linux() {
  if have apt-get; then
    log "installing Node 20 via apt (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif have dnf; then
    log "installing Node 20 via dnf"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
    sudo dnf install -y nodejs
  elif have pacman; then
    log "installing Node via pacman"
    sudo pacman -Sy --noconfirm nodejs npm
  elif have apk; then
    log "installing Node via apk"
    sudo apk add --no-cache nodejs npm
  else
    die "No supported package manager found (apt/dnf/pacman/apk). Install Node 20+ manually."
  fi
}

ensure_node() {
  local current
  current="$(node_major)"
  if [ "$current" -ge "$NODE_MIN_MAJOR" ]; then
    log "Node $(node -v) OK"
    return
  fi
  warn "Node missing or < ${NODE_MIN_MAJOR}. Installing..."
  case "$OS_KIND" in
    macos)         install_node_macos ;;
    linux)         install_node_linux ;;
    windows-bash)  die "On Windows use 'make setup' from PowerShell (calls setup.ps1) or install Node 20+ from https://nodejs.org" ;;
    *)             die "Unsupported OS. Install Node 20+ manually." ;;
  esac
  have node || die "Node install failed."
  log "Node $(node -v) installed"
}

ensure_npm() {
  have npm || die "npm not found after Node install — check your PATH."
}

setup_env_file() {
  local dir="$1" example="$2" target="$3"
  if [ ! -f "$dir/$target" ]; then
    if [ -f "$dir/$example" ]; then
      cp "$dir/$example" "$dir/$target"
      log "created $dir/$target from $example"
    fi
  else
    log "$dir/$target already exists — kept"
  fi
}

install_backend() {
  log "installing back-end dependencies"
  ( cd back-end && npm install --no-audit --no-fund --prefer-offline )
  setup_env_file back-end .env.example .env

  # Pick the active provider (swaps schema.prisma + copies migrations in).
  # Default sqlite — keeps the zero-daemon promise for `make setup`.
  local provider="${DATABASE_PROVIDER:-sqlite}"
  log "preparing database provider: $provider"
  bash scripts/db-prepare.sh

  log "running Prisma generate + migrate ($provider)"
  ( cd back-end && npx prisma generate )

  local has_migrations=""
  if [ -d back-end/prisma/migrations ] && \
     [ -n "$(ls -A back-end/prisma/migrations 2>/dev/null | grep -v migration_lock.toml || true)" ]; then
    has_migrations=1
  fi

  if [ "$provider" = "postgresql" ]; then
    # Never `migrate dev` in setup (needs a shadow DB). Deploy committed migrations.
    ( cd back-end && npx prisma migrate deploy ) || die \
      "Postgres migrate deploy failed. Set DATABASE_URL to a running PostgreSQL (DATABASE_PROVIDER=postgresql) and rerun 'make setup'."
  elif [ -n "$has_migrations" ]; then
    ( cd back-end && npx prisma migrate deploy )
  else
    # First-time sqlite with no migrations copied in — create the baseline.
    ( cd back-end && npx prisma migrate dev --name init --skip-seed )
  fi
}

install_frontend() {
  log "installing front-end dependencies"
  ( cd front-end && npm install --no-audit --no-fund --prefer-offline )
  setup_env_file front-end .env.example .env.local
}

ensure_node
ensure_npm
install_backend
install_frontend

cat <<EOF

[setup] done.
  Start everything:   make dev
  Back-end only:      make dev-back
  Front-end only:     make dev-front
  Verify (lint/build):make verify

EOF
