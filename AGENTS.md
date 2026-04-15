# AGENTS.md

## Purpose

This file is the contributor handoff guide for the Cloud-Based Workforce Task Management System repository. It explains how to work safely in this repo, where the important backend materials live, and what is already stable versus what is now optional future work.

## Repository Layout

```text
cloud-computing-project/
  AGENTS.md
  README.md
  backend/
  frontend/
```

- `backend/` contains the Node.js + Express API.
- `frontend/` contains the static SPA implementation used for the class demo.

## Current Backend Status

Completed:

- Phase 0: foundation
- Phase 1: environment and database schema
- Phase 2: authentication and RBAC
- Phase 3: users and teams
- Phase 4: tasks and assignment
- Phase 5: dashboards
- Phase 6: hours logging
- Phase 7: productivity metrics
- Phase 8: goals and quotas
- Phase 9: hardening and deployment

Optional next work:

- task comments and activity history
- richer reminder delivery (email/push or scheduled jobs)
- file attachments

## Backend Stack

- Node.js 22 LTS target
- Express 5
- Supabase PostgreSQL
- Supabase Auth through backend endpoints
- `pg`
- Zod
- Vitest
- Supertest

## Important Backend Docs

All backend documentation lives in `backend/docs/`.

- [PROJECT_OVERVIEW.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/PROJECT_OVERVIEW.md)
- [BACKEND_ARCHITECTURE.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/BACKEND_ARCHITECTURE.md)
- [DEVELOPMENT_ROADMAP.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/DEVELOPMENT_ROADMAP.md)
- [MODULE_PROGRESS.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/MODULE_PROGRESS.md)
- [DATABASE_SCHEMA.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/DATABASE_SCHEMA.md)
- [TESTING_STRATEGY.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/TESTING_STRATEGY.md)
- [AUTH_AND_RBAC.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/AUTH_AND_RBAC.md)
- [API_REFERENCE.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/API_REFERENCE.md)
- [FRONTEND_INTEGRATION_GUIDE.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/FRONTEND_INTEGRATION_GUIDE.md)
- [ERROR_HANDLING_CONVENTIONS.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/ERROR_HANDLING_CONVENTIONS.md)
- [API_EXAMPLES.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/API_EXAMPLES.md)
- [ENVIRONMENT_VARIABLES.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/ENVIRONMENT_VARIABLES.md)
- [DEPLOYMENT_GUIDE.md](/Users/admin/Documents/GitHub/cloud-computing-project/backend/docs/DEPLOYMENT_GUIDE.md)

## Backend Commands

Run from `/Users/admin/Documents/GitHub/cloud-computing-project/backend`.

Install dependencies:

```bash
npm install
```

Run the API:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run a smoke check:

```bash
npm run smoke:local
```

Run the deeper live audit:

```bash
npm run audit:local
```

Seed demo auth users:

```bash
npm run seed:demo-users
```

Seed the repeatable live demo group:

```bash
npm run seed:demo-group
```

Check linked Supabase migrations:

```bash
supabase migration list
```

Push pending migrations:

```bash
supabase db push
```

## Environment Rules

- Use `backend/.env.example` as the template for local setup.
- Keep the real `backend/.env` untracked.
- Do not commit Supabase keys, the database password, or demo credentials into tracked files.
- This repo currently uses the linked Supabase project `cloud_computing`.

## Current Stable API Surface

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/manager-access`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/:userId/avatar`
- `GET /api/v1/teams`
- `POST /api/v1/teams`
- `GET /api/v1/teams/:teamId`
- `PATCH /api/v1/teams/:teamId`
- `GET /api/v1/teams/:teamId/members`
- `POST /api/v1/teams/:teamId/members`
- `DELETE /api/v1/teams/:teamId/members/:userId`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `POST /api/v1/task-assignments`
- `GET /api/v1/dashboards/employee`
- `GET /api/v1/dashboards/manager`
- `GET /api/v1/hours-logged`
- `POST /api/v1/hours-logged`
- `GET /api/v1/productivity-metrics`
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/:goalId`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId/read`
- `DELETE /api/v1/notifications/:notificationId`

All responses use the standard success/error JSON envelope documented in the backend docs.

## Demo Accounts

These demo accounts are expected to exist after running `npm run seed:demo-users`:

- `manager.demo@cloudcomputing.local`
- `employee.one@cloudcomputing.local`
- `employee.two@cloudcomputing.local`

## Contributor Rules

- Keep the backend modular: routes -> controllers -> services -> repositories.
- Do not put SQL or business logic directly in controllers.
- Keep docs aligned with implementation. Do not document endpoints that do not exist.
- Add or update tests whenever a route, service, validator, or auth rule changes.
- Preserve the consistent API response structure.
- Prefer student-manageable solutions over unnecessary abstraction.
- Use phased delivery. Finish code, tests, docs, and progress tracking for one phase before moving to the next.
- For module-based Codex work, stay inside the declared module scope, inspect relevant files before editing, make the smallest correct change, and separate confirmed facts from assumptions.
- After each module, report files changed, commands run, validation results, blockers, and the recommended next module.

## When Adding New Backend Features

1. update the relevant docs first or alongside code
2. add validators before wiring controllers
3. add service and repository layers for new business logic
4. add automated tests
5. update `MODULE_PROGRESS.md`
6. verify the frontend-facing docs still match reality

## Recommended Next Work

The planned roadmap is complete. If the team wants to extend the project, the best next features are:

- task comments and task activity history
- file attachments
- richer notification delivery for due and overdue tasks
- export-ready manager reporting
