# Backend Architecture

> Note:
> This document still includes the historical build-out of hours logging, productivity metrics, and goals because those backend surfaces remain in the codebase. The promoted live product has since been narrowed to the focused task-flow spine centered on Dashboard, Worker Tracker, Tasks, Teams, Join Team, Calendar, and Profile.

## Recommended Stack

| Area | Choice | Why it fits this project |
| --- | --- | --- |
| Runtime | Node.js 22 LTS | Current stable LTS baseline, easy local setup, smooth student deployment story |
| Web framework | Express 5 | Minimal, well-known, and ideal for a straightforward REST API |
| Database | Supabase PostgreSQL | Meets the project requirement and provides managed Postgres with practical developer tooling |
| Authentication | Supabase Auth through backend endpoints | Keeps frontend integration simple while using a strong managed auth provider |
| Validation | Zod | Clear request validation rules with readable error structures |
| Testing | Vitest + Supertest | Fast setup for API tests without extra complexity |
| Deployment | Render | Easy Node service deployment, monorepo support, and simple environment variable management for student teams |

## Architecture Summary

The backend uses a layered structure to keep responsibilities separated:

1. Client layer
   Frontend dashboard built separately in `/frontend` and consumes REST endpoints.
2. Application layer
   Express routes, controllers, services, validators, auth, RBAC, error handling, and response formatting.
3. Data layer
   Supabase PostgreSQL with normalized tables, constraints, and indexes.

## Current Implementation Status

Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, and Phase 9 are complete:

- Express application foundation is in place
- centralized success and error response conventions are stable
- health responses include database readiness details
- environment parsing is implemented in `src/config/env.js`
- database connectivity helpers are implemented in `src/db/*`
- the MVP schema has been pushed to the linked Supabase project
- auth endpoints are implemented in `src/routes/auth.routes.js`
- Supabase-backed token verification is implemented in `src/services/auth.service.js`
- RBAC middleware is implemented in `src/middleware/*`
- user profile route is implemented in `src/routes/users.routes.js`
- team list and roster routes are implemented in `src/routes/teams.routes.js`
- team access scoping is implemented in `src/services/team.service.js` and `src/repositories/team.repository.js`
- task CRUD routes are implemented in `src/routes/tasks.routes.js`
- task assignment route is implemented in `src/routes/taskAssignments.routes.js`
- task access, filtering, and assignment rules are implemented in `src/services/task.service.js` and `src/repositories/task.repository.js`
- dashboard routes are implemented in `src/routes/dashboards.routes.js`
- dashboard aggregation logic is implemented in `src/services/dashboard.service.js` and `src/repositories/dashboard.repository.js`
- hours logging routes are implemented in `src/routes/hoursLogged.routes.js`
- hours logging scope and summary logic are implemented in `src/services/hoursLogged.service.js` and `src/repositories/hoursLogged.repository.js`
- productivity metrics route is implemented in `src/routes/productivity.routes.js`
- productivity rollups and trend aggregation are implemented in `src/services/productivity.service.js` and `src/repositories/productivity.repository.js`
- goals routes are implemented in `src/routes/goals.routes.js`
- goal scope, quota progress, and summary logic are implemented in `src/services/goal.service.js` and `src/repositories/goal.repository.js`
- reusable smoke verification is implemented in `scripts/smoke-test.js`
- a Render deployment Blueprint is included at the repo root in `render.yaml`

## Request Flow

```text
Frontend request
  -> Express route
  -> Controller
  -> Validator
  -> Service
  -> Repository
  -> Supabase PostgreSQL
  -> Response formatter
  -> Frontend
```

This keeps HTTP concerns out of business logic and keeps database queries out of controllers.

## Core Design Decisions

### API Style

- RESTful endpoints under `/api/v1`
- JSON request and response bodies
- consistent response envelope for all endpoints
- predictable filtering, sorting, and pagination rules as the API grows

### Authentication and RBAC

- Supabase Auth is the identity provider
- the frontend will authenticate through backend `/auth/*` endpoints
- backend middleware will verify tokens and load app-specific user role and team scope
- employees only see permitted personal data
- managers can assign tasks and view team summaries
- employees can only see tasks actively assigned to them and can only update task status, progress, and notes
- authenticated users can log hours for themselves
- managers can view hours logged for teams they manage
- employees can access only their own productivity metrics
- managers can access team productivity metrics and individual productivity metrics for users in manageable teams
- employees can view team-scoped goals for their teams and user-scoped goals assigned to them
- managers can create and update team-scoped or employee-scoped goals for teams they manage
- the current implementation includes `POST /auth/login`, `GET /auth/me`, `GET /users/me`, `GET /teams`, `GET /teams/:teamId`, `GET /teams/:teamId/members`, `GET /tasks`, `POST /tasks`, `GET /tasks/:taskId`, `PATCH /tasks/:taskId`, `DELETE /tasks/:taskId`, `POST /task-assignments`, `GET /dashboards/employee`, `GET /dashboards/manager`, `GET /hours-logged`, `POST /hours-logged`, `GET /productivity-metrics`, `GET /goals`, `POST /goals`, `PATCH /goals/:goalId`, and a manager-only RBAC smoke-check route

### Data Model Direction

MVP tables implemented in Phase 1:

- `users`
- `teams`
- `team_members`
- `tasks`
- `task_assignments`
- enum types for role, task status, and task priority

Optional post-roadmap enhancements:

- task comments and activity history
- file attachments
- reminder notifications
- export-ready reporting

### Deployment Choice

Render is the default deployment target because it is simple for a student team:

- fast Node service setup
- root-level Blueprint support for monorepos
- built-in environment variable management
- straightforward deploy logs
- enough capability for a course project without extra infrastructure overhead

## Backend Folder Structure

```text
backend/
  docs/
  scripts/
  sql/
  src/
    app.js
    server.js
    config/
    constants/
    controllers/
    db/
    middleware/
    repositories/
    routes/
    services/
    utils/
    validators/
  tests/
    integration/
```

## Response Conventions

### Success Response

```json
{
  "success": true,
  "message": "Backend service is healthy.",
  "data": {
    "status": "ok",
    "database": {
      "status": "connected"
    }
  },
  "meta": {
    "timestamp": "2026-03-25T00:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found: GET /api/v1/unknown",
    "details": []
  },
  "meta": {
    "timestamp": "2026-03-25T00:00:00.000Z",
    "path": "/api/v1/unknown",
    "method": "GET"
  }
}
```

## Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, and Phase 9 Verification

The current backend foundation has been verified with:

- `GET /api/v1/health` returns HTTP 200
- the health endpoint uses the standard success envelope
- the health endpoint reports database readiness
- unknown routes use the centralized error handler
- the app can be imported in tests without binding a network port
- environment parsing tests
- database health helper tests
- successful Supabase migration push for the MVP schema
- auth service tests
- auth middleware and RBAC middleware tests
- auth route integration tests
- successful Supabase migration push for auth profile sync
- live verification of manager login, employee login, `/auth/me`, and manager-only access control
- user route integration tests
- team route integration tests
- team service unit tests
- live verification of `/users/me`, `/teams`, `/teams/:teamId`, and `/teams/:teamId/members`
- task route integration tests
- task assignment route integration tests
- task service unit tests
- live verification of task create, assign, list, employee status update, and delete flows
- dashboard route integration tests
- dashboard service unit tests
- live verification of employee and manager dashboard aggregate responses
- hours logged route integration tests
- hours logged service unit tests
- successful Supabase migration push for the hours logging schema
- live verification of hours log creation, scoped listing, and summary totals
- productivity route integration tests
- productivity service unit tests
- live verification of team and individual productivity rollups, scope enforcement, and cleanup
- goals route integration tests
- goal service unit tests
- goal progress utility tests
- successful Supabase migration push for the goals schema
- live verification of user-scoped goals, team-scoped goals, quota progress, manager-only writes, and cleanup
- deployment-oriented smoke script verification
- root-level Render Blueprint committed for repeatable deployment setup

## Current Frontend-Facing Notes

The frontend team can rely on these contracts right now:

- API base prefix is `/api/v1`
- health endpoint is `GET /api/v1/health`
- health responses include `data.database.status`
- login endpoint is `POST /api/v1/auth/login`
- authenticated profile endpoint is `GET /api/v1/auth/me`
- authenticated user profile endpoint is `GET /api/v1/users/me`
- scoped team list endpoint is `GET /api/v1/teams`
- scoped team detail endpoint is `GET /api/v1/teams/:teamId`
- scoped team roster endpoint is `GET /api/v1/teams/:teamId/members`
- task list endpoint is `GET /api/v1/tasks`
- task create endpoint is `POST /api/v1/tasks`
- task detail endpoint is `GET /api/v1/tasks/:taskId`
- task update endpoint is `PATCH /api/v1/tasks/:taskId`
- task delete endpoint is `DELETE /api/v1/tasks/:taskId`
- task assignment endpoint is `POST /api/v1/task-assignments`
- employee dashboard endpoint is `GET /api/v1/dashboards/employee`
- manager dashboard endpoint is `GET /api/v1/dashboards/manager`
- hours logged list endpoint is `GET /api/v1/hours-logged`
- hours logged create endpoint is `POST /api/v1/hours-logged`
- productivity metrics endpoint is `GET /api/v1/productivity-metrics`
- goals endpoint is `GET /api/v1/goals`
- goal create endpoint is `POST /api/v1/goals`
- goal update endpoint is `PATCH /api/v1/goals/:goalId`
- the planned backend roadmap is complete and ready for deployment handoff
- all future endpoints will follow the same top-level success and error envelope
- unknown routes already return structured JSON errors instead of raw HTML

These guarantees are enough to build:

- a shared `fetch()` wrapper
- common loading and error state handling
- environment-based API base URL configuration
