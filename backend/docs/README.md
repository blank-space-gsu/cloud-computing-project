# TaskTrail backend docs

These documents describe how the TaskTrail backend is built, how it's deployed, and how clients integrate with it. Start with the overview, then dip into whichever area you're working on.

If you need the broader product/repo picture first, read the [root README](../../README.md). If you're touching the web client, pair these docs with [frontend/README.md](../../frontend/README.md).

## Start here

- [Project overview](PROJECT_OVERVIEW.md) — what the product is and who it's for
- [Backend architecture](BACKEND_ARCHITECTURE.md) — layered structure, request flow, stack choices
- [Development roadmap](DEVELOPMENT_ROADMAP.md) — phased build-out and recent focus shifts
- [Module progress](MODULE_PROGRESS.md) — live status board for backend modules

## Data and auth

- [Database schema](DATABASE_SCHEMA.md) — tables, constraints, and relationships
- [Auth and RBAC](AUTH_AND_RBAC.md) — Supabase Auth integration and role-based access rules

## API

- [API reference](API_REFERENCE.md) — every endpoint and response envelope
- [API examples](API_EXAMPLES.md) — copy/paste request and response examples
- [Frontend integration guide](FRONTEND_INTEGRATION_GUIDE.md) — how the web and mobile clients consume the API
- [Error handling conventions](ERROR_HANDLING_CONVENTIONS.md) — standard error codes and shapes

## Operations

- [Environment variables](ENVIRONMENT_VARIABLES.md) — required and optional env for local and production
- [Testing strategy](TESTING_STRATEGY.md) — unit, integration, smoke, and audit
- [Deployment guide](DEPLOYMENT_GUIDE.md) — Docker + GHCR + Oracle Cloud + health-gated rollout
