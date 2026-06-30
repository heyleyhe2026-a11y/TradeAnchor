# TradeAnchor

AI-driven trading journal platform for retail traders in forex, crypto, and stock markets.

## Project Structure

This is a monorepo managed with pnpm workspaces:

```
tradeanchor/
├── packages/
│   ├── backend/          # NestJS API server (Express + TypeScript)
│   ├── frontend/         # React + Vite + TypeScript web application
│   ├── shared/           # Shared types and utilities
│   ├── marketing/        # Astro-based marketing landing site
│   └── prerender/        # SEO prerender service
├── package.json          # Root package configuration
├── pnpm-workspace.yaml   # Workspace configuration
├── tsconfig.json         # Root TypeScript configuration
├── docker-compose.yml    # Local development stack
├── docker-compose.prod.yml # Production Docker Compose stack
├── Dockerfile.backend    # Backend production image
├── Dockerfile.frontend   # Frontend production image
├── nginx/                # Nginx configuration templates
├── k8s/                  # Kubernetes manifests
├── monitoring/           # Prometheus & Grafana configuration
└── docs/                 # Additional documentation
```

## Tech Stack

- **Backend**: NestJS / Express, TypeScript, Prisma ORM, PostgreSQL, Redis, MongoDB
- **Frontend**: React 18, Vite, TypeScript, MUI, Redux Toolkit, React Router
- **Marketing**: Astro, Nginx
- **DevOps**: Docker, Docker Compose, Prometheus, Grafana, GitHub Actions

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL (local or Docker)
- Redis (local or Docker)
- MongoDB (local or Docker)

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install
```

### Environment Variables

Copy the example files and configure your secrets:

```bash
# Backend
cp packages/backend/.env.example packages/backend/.env

# Frontend
cp packages/frontend/.env.example packages/frontend/.env
```

> **⚠️ Security Warning**  
> Never commit real `.env` files, API keys, passwords, or server IPs to Git. They are excluded via `.gitignore`.

### Development

```bash
# Run all packages in development mode
pnpm dev

# Run specific package
pnpm --filter @tradeanchor/backend dev
pnpm --filter @tradeanchor/frontend dev
```

### Database Setup

```bash
# Generate Prisma client
pnpm --filter @tradeanchor/backend db:generate

# Run migrations
pnpm --filter @tradeanchor/backend db:migrate

# (Optional) Seed mock data
pnpm --filter @tradeanchor/backend db:seed
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @tradeanchor/backend build
pnpm --filter @tradeanchor/frontend build
```

### Testing

```bash
# Run tests for all packages
pnpm test

# Run tests for specific package
pnpm --filter @tradeanchor/backend test
```

### Linting & Formatting

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format
```

## Docker Development

```bash
# Start the full local stack (Postgres + Redis + MongoDB + Backend + Frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Production Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

Make sure you have a `.env` file in the project root with production secrets before running the production compose file.

## CI/CD

GitHub Actions workflows are defined in `.github/workflows/`:

- `ci.yml` — lint, type-check, test, build and Docker image builds on push/PR
- `cd.yml` — deploy to Kubernetes staging/production environments

Required repository secrets (do not commit these values):

- `KUBE_CONFIG_STAGING`, `KUBE_CONFIG_PRODUCTION`
- `DOCKER_USERNAME`, `DOCKER_PASSWORD`
- `SLACK_WEBHOOK`
- `VITE_API_BASE_URL`

## Package Details

### @tradeanchor/backend

Backend API service built with:

- Express.js / NestJS patterns
- TypeScript
- Prisma ORM
- PostgreSQL, Redis, MongoDB
- JWT authentication
- Swagger API docs
- Prometheus metrics

### @tradeanchor/frontend

Frontend web application built with:

- React 18
- TypeScript
- Vite
- React Router
- MUI / Emotion
- Redux Toolkit
- Recharts for data visualization

### @tradeanchor/shared

Shared TypeScript types and utility functions used across backend and frontend.

## Security Notes

- All real credentials, API keys, and server IPs are kept in `.env` files and excluded from version control.
- Deployment scripts containing real server details (e.g. `deploy.ps1`) are excluded from version control.
- The repository contains only templates and example files for configuration and deployment.
- Before making the repository public, rotate any API keys that may have been exposed in local history.

## Documentation

- `AI_MODELS_GUIDE.md` — AI provider integration guide
- `CI_CD_MONITORING.md` — CI/CD and monitoring setup
- `DEPLOYMENT.md` — Full deployment guide
- `DEPLOY_INCREMENTAL.md` — Incremental deployment workflow
- `TASK_1.6_COMPLETION_REPORT.md` — Task completion report

## License

MIT
