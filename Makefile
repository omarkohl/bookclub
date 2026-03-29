.PHONY: help build build-frontend build-backend lint lint-frontend lint-backend fmt fmt-check test test-backend test-frontend e2e e2e-headed dev dev-backend dev-all clean

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

build: build-frontend build-backend ## Build everything (frontend + Go binary)

build-frontend: ## Build frontend with Vite
	cd frontend && npm run build

build-backend: build-frontend ## Build Go binary with embedded frontend
	mkdir -p internal/handler/frontend
	cp -r frontend/dist/* internal/handler/frontend/
	go build -o bin/bookclub ./cmd/bookclub

lint: lint-frontend lint-backend ## Run all linters

lint-frontend: ## Run ESLint on frontend
	cd frontend && npx eslint src/

lint-backend: ## Run golangci-lint on Go code
	golangci-lint run ./...

fmt: ## Format all code
	gofmt -w .
	cd frontend && npx prettier --write src/

fmt-check: ## Check formatting without modifying files
	@test -z "$$(gofmt -l .)" || (echo "gofmt needed on:"; gofmt -l .; exit 1)
	cd frontend && npx prettier --check src/

test: test-backend test-frontend ## Run all tests

test-backend: ## Run Go integration tests
	go test ./... -v

test-frontend: ## Run frontend tests (Vitest)
	cd frontend && npx vitest run

e2e: build ## Run Playwright e2e tests (builds first)
	cd frontend && npx playwright test

e2e-headed: build ## Run Playwright e2e tests with visible browser
	cd frontend && npx playwright test --headed

dev: ## Start Vite dev server (frontend only, proxies /api to :8080)
	cd frontend && npm run dev

dev-backend: ## Start Go backend with default secrets (club/admin)
	go run ./cmd/bookclub

dev-all: ## Start both backend and frontend dev servers
	@echo "Starting Go backend on :8080 and Vite on :5173..."
	@echo "  User UI:  http://localhost:5173/club/"
	@echo "  Admin UI: http://localhost:5173/club/admin/admin/"
	@bash -c 'trap "kill 0" EXIT; $(MAKE) dev-backend & $(MAKE) dev & wait -n; exit 1'

clean: ## Remove build artifacts
	rm -rf bin/ internal/handler/frontend/ frontend/dist/
