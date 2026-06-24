#!/usr/bin/env bash
# Select the active database provider for Prisma.
#
# Prisma's datasource `provider` must be a static literal (it cannot be env()),
# so we swap it here based on DATABASE_PROVIDER (default: sqlite), and copy the
# matching per-provider migrations into the active prisma/migrations/ dir.
#
# Idempotent — re-run anytime. Reads DATABASE_PROVIDER from the environment.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

log()  { printf '\033[1;36m[db-prepare]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[db-prepare]\033[0m %s\n' "$*" >&2; exit 1; }

PROVIDER="${DATABASE_PROVIDER:-sqlite}"
case "$PROVIDER" in
  sqlite|postgresql) ;;
  *) die "DATABASE_PROVIDER='$PROVIDER' is invalid. Use 'sqlite' or 'postgresql'." ;;
esac

# Provider value (postgresql) differs from the migrations dir suffix (postgres).
case "$PROVIDER" in
  postgresql) PROVIDER_DIR="postgres" ;;
  *)          PROVIDER_DIR="$PROVIDER" ;;
esac

SCHEMA="back-end/prisma/schema.prisma"
MIGRATIONS_DIR="back-end/prisma/migrations"
SRC_DIR="back-end/prisma/migrations-$PROVIDER_DIR"

[ -f "$SCHEMA" ] || die "schema not found at $SCHEMA"
[ -d "$SRC_DIR" ] || die "migrations source dir not found at $SRC_DIR"

# 1. Swap the datasource provider line to the chosen provider.
#    Match only the provider inside the datasource block (lines like:
#    `  provider = "sqlite"` / `  provider = "postgresql"`), not the generator.
tmp="$(mktemp)"
sed -E "s/^([[:space:]]*provider[[:space:]]*=[[:space:]]*)\"(sqlite|postgresql)\"/\\1\"$PROVIDER\"/" "$SCHEMA" > "$tmp"
mv "$tmp" "$SCHEMA"

# 2. Wipe + copy the matching migrations into the active dir (copy, not symlink,
#    so it works on Windows too).
rm -rf "$MIGRATIONS_DIR"
mkdir -p "$MIGRATIONS_DIR"
cp -R "$SRC_DIR/." "$MIGRATIONS_DIR/"

log "provider=$PROVIDER (schema + migrations from migrations-$PROVIDER_DIR/)"
