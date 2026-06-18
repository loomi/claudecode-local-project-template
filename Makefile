# Root Makefile — orchestrates the monorepo across macOS / Linux / Windows.
#
# Targets:
#   make setup     — install Node if missing, deps, .env files, first migration
#   make dev       — back-end + front-end in parallel (Ctrl-C kills both)
#   make dev-back  — back-end only
#   make dev-front — front-end only
#   make verify    — lint + build (back) + typecheck (front)
#   make test      — unit tests (back-end)
#   make migrate   — Prisma migrate dev (asks for migration name)
#   make studio    — Prisma Studio
#   make reset     — wipe SQLite DB and re-apply migrations
#   make clean     — remove node_modules and SQLite files
#
# Windows users: invoke `make ...` from a PowerShell-aware Make (e.g. via
# scoop install make / choco install make / Git Bash). The targets shell out
# to scripts/*.ps1 on Windows and scripts/*.sh elsewhere.

SHELL := /bin/sh

# Detect host OS — Make on Windows usually reports "Windows_NT" via $OS.
ifeq ($(OS),Windows_NT)
  HOST_OS := windows
else
  UNAME_S := $(shell uname -s 2>/dev/null)
  ifeq ($(UNAME_S),Darwin)
    HOST_OS := macos
  else ifeq ($(UNAME_S),Linux)
    HOST_OS := linux
  else
    HOST_OS := unknown
  endif
endif

ifeq ($(HOST_OS),windows)
  RUN_SH    = powershell -NoProfile -ExecutionPolicy Bypass -File scripts/$(1).ps1
  PRINT_OS  = @echo Host OS: windows
else
  RUN_SH    = bash scripts/$(1).sh
  PRINT_OS  = @echo "Host OS: $(HOST_OS)"
endif

.PHONY: help setup dev dev-back dev-front verify test migrate studio reset clean os

help:
	@echo "Targets:"
	@echo "  setup       Install Node (if missing), deps, .env, first migration"
	@echo "  dev         Run back-end + front-end in parallel"
	@echo "  dev-back    Run back-end only"
	@echo "  dev-front   Run front-end only"
	@echo "  verify      Lint + build (back-end) + typecheck (front-end)"
	@echo "  test        Run back-end unit tests"
	@echo "  migrate     Prisma migrate dev"
	@echo "  studio      Prisma Studio (DB GUI)"
	@echo "  reset       Wipe SQLite DB and re-apply migrations"
	@echo "  clean       Remove node_modules + SQLite files"

os:
	$(PRINT_OS)

setup:
	$(call RUN_SH,setup)

dev:
	$(call RUN_SH,dev)

dev-back:
	$(MAKE) -C back-end dev

dev-front:
	$(MAKE) -C front-end dev

verify:
	$(call RUN_SH,verify)

test:
	$(MAKE) -C back-end test

migrate:
	$(MAKE) -C back-end migrate

studio:
	$(MAKE) -C back-end studio

reset:
	$(MAKE) -C back-end reset

clean:
	@rm -rf back-end/node_modules back-end/dist front-end/node_modules front-end/.next 2>/dev/null || true
	@rm -f back-end/prisma/dev.db back-end/prisma/dev.db-journal 2>/dev/null || true
	@echo "[clean] done"
