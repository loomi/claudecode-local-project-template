# Back-end Makefile. Thin wrappers around npm scripts so the workflow is
# discoverable and identical across operating systems.

.PHONY: help install dev build start lint test test-e2e migrate deploy generate studio reset

help:
	@echo "Back-end targets:"
	@echo "  install     npm install"
	@echo "  dev         npm run start:dev (watch)"
	@echo "  build       npm run build"
	@echo "  start       npm run start:prod"
	@echo "  lint        npm run lint"
	@echo "  test        npm test"
	@echo "  test-e2e    npm run test:e2e"
	@echo "  migrate     prisma migrate dev"
	@echo "  deploy      prisma migrate deploy"
	@echo "  generate    prisma generate"
	@echo "  studio      prisma studio"
	@echo "  reset       prisma migrate reset"

install:   ; npm install --no-audit --no-fund --prefer-offline
dev:       ; npm run start:dev
build:     ; npm run build
start:     ; npm run start:prod
lint:      ; npm run lint
test:      ; npm test
test-e2e:  ; npm run test:e2e
migrate:   ; npx prisma migrate dev
deploy:    ; npx prisma migrate deploy
generate:  ; npx prisma generate
studio:    ; npx prisma studio
reset:     ; npx prisma migrate reset --force
