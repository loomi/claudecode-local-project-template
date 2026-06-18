# Front-end Makefile. Thin wrappers around npm scripts.

.PHONY: help install dev build start lint typecheck

help:
	@echo "Front-end targets:"
	@echo "  install     npm install"
	@echo "  dev         npm run dev"
	@echo "  build       npm run build"
	@echo "  start       npm run start"
	@echo "  lint        npm run lint"
	@echo "  typecheck   npm run typecheck"

install:   ; npm install --no-audit --no-fund --prefer-offline
dev:       ; npm run dev
build:     ; npm run build
start:     ; npm run start
lint:      ; npm run lint
typecheck: ; npm run typecheck
