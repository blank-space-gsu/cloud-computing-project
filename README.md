# Cloud-Based Workforce Task Management System

University cloud computing project for a workforce task management web application. The repository is organized as a simple monorepo so the backend and frontend teams can work in parallel without mixing concerns.

## Project Overview

The application helps managers assign and monitor work while giving employees a clear view of what they need to complete. The backend is being built first as a modular REST API that a plain HTML, CSS, and JavaScript frontend can consume without extra framework assumptions.

### MVP

- Managers can assign tasks to employees.
- Managers can view employee workload and completion progress.
- Employees can view their assigned tasks and update task status.
- Teams, due dates, priorities, and weekly task organization are supported.

### Planned After MVP

- Goal and quota tracking
- Deployment hardening and final presentation polish

## Repository Layout

```text
cloud-computing-project/
  backend/   # Node.js + Express REST API
  frontend/  # Separate frontend workspace
```

## Backend Stack

- Node.js 22 LTS
- Express 5
- Supabase PostgreSQL
- Supabase Auth wrapped by backend endpoints
- Zod for validation
- Vitest + Supertest for testing
- Render for deployment

## Current Backend Status

Phases 0, 1, 2, 3, 4, 5, 6, and 7 are implemented in `/backend`:

- Express app bootstrap
- `GET /api/v1/health`
- Standard API success and error envelopes
- Centralized error handling
- Environment validation and database utilities
- MVP schema SQL and database documentation
- Supabase-backed login and current-user endpoints
- RBAC middleware and manager-only access guard
- authenticated user profile endpoint
- scoped teams list, team detail, and team member roster endpoints
- task CRUD endpoints
- manager task assignment endpoint
- employee task status/progress update support
- employee dashboard summary endpoint
- manager dashboard summary endpoint
- hours logging create and list endpoints
- productivity metrics summary endpoint
- Demo auth user seed script for manual QA
- Phase roadmap and architecture documentation

## Quick Start

```bash
cd backend
npm install
npm run dev
```

Run tests:

```bash
cd backend
npm test
```

## Key Backend Docs

- [Project overview](backend/docs/PROJECT_OVERVIEW.md)
- [Backend architecture](backend/docs/BACKEND_ARCHITECTURE.md)
- [Development roadmap](backend/docs/DEVELOPMENT_ROADMAP.md)
- [Module progress board](backend/docs/MODULE_PROGRESS.md)
- [Database schema](backend/docs/DATABASE_SCHEMA.md)
- [Environment variables](backend/docs/ENVIRONMENT_VARIABLES.md)
- [Auth and RBAC](backend/docs/AUTH_AND_RBAC.md)
- [API reference](backend/docs/API_REFERENCE.md)
- [Frontend integration guide](backend/docs/FRONTEND_INTEGRATION_GUIDE.md)
- [Error handling conventions](backend/docs/ERROR_HANDLING_CONVENTIONS.md)

## Frontend Team Notes

The backend currently guarantees:

- Base API prefix: `/api/v1`
- Health endpoint: `GET /api/v1/health`
- Consistent response envelope for success and error responses
- Database health status appears under `data.database`
- Login endpoint: `POST /api/v1/auth/login`
- Current-user endpoint: `GET /api/v1/auth/me`
- User profile endpoint: `GET /api/v1/users/me`
- Team list endpoint: `GET /api/v1/teams`
- Team detail endpoint: `GET /api/v1/teams/:teamId`
- Team member endpoint: `GET /api/v1/teams/:teamId/members`
- Task list endpoint: `GET /api/v1/tasks`
- Task create endpoint: `POST /api/v1/tasks`
- Task detail endpoint: `GET /api/v1/tasks/:taskId`
- Task update endpoint: `PATCH /api/v1/tasks/:taskId`
- Task delete endpoint: `DELETE /api/v1/tasks/:taskId`
- Task assignment endpoint: `POST /api/v1/task-assignments`
- Employee dashboard endpoint: `GET /api/v1/dashboards/employee`
- Manager dashboard endpoint: `GET /api/v1/dashboards/manager`
- Hours logged list endpoint: `GET /api/v1/hours-logged`
- Hours logged create endpoint: `POST /api/v1/hours-logged`
- Productivity metrics endpoint: `GET /api/v1/productivity-metrics`

Future backend modules will continue using the same response conventions so the frontend team can build fetch helpers early and reuse them across features.
