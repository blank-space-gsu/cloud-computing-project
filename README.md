# TaskTrail

University cloud computing project for TaskTrail, a team-based task assignment web application. The repository is organized as a simple monorepo so the backend and frontend teams can work in parallel without mixing concerns.

## Project Overview

The application helps managers assign and monitor work while giving employees a clear view of what they need to complete. The backend is implemented as a modular REST API, and the frontend is a plain HTML, CSS, and JavaScript single-page app that consumes those endpoints without a framework dependency.

### Current Product Spine

Manager experience:

- Dashboard as a lightweight attention surface
- Worker Tracker as the main drilldown surface
- Tasks for direct task creation, assignment, and editing
- Teams for team management and join access
- Profile for lightweight account and notification context

Employee experience:

- Join Team onboarding
- My Tasks for assigned work, progress, and completion
- Calendar for due-date visibility across active teams
- Teams for membership visibility and leave flow
- Profile for lightweight account and notification context

### Optional Next Enhancements

- task comments and activity history
- file attachments
- scheduled or email-based reminder delivery
- export-ready reporting

## Repository Layout

```text
cloud-computing-project/
  backend/   # Node.js + Express REST API
  frontend/  # Plain HTML/CSS/JS frontend app
```

## Frontend Status

The frontend lives in `/frontend` and is now implemented.

Current frontend experience:

- Public landing page before sign-in
- Role-based login flow for manager and employee accounts
- Manager Dashboard, Worker Tracker, Tasks, Teams, and Profile
- Employee Tasks, Calendar, Teams, Join Team, and Profile
- Manager join-access controls for team codes and invite links
- Employee join, leave, and rejoin flow
- Backend-backed self-profile editing for safe personal info fields
- Backend-backed notification list, read, and dismiss actions
- Responsive TaskTrail UI using shared components and hash-based routing

Frontend notes:

- The frontend work was kept separate from backend source changes.
- Seeded demo data is shown through the backend seed scripts and API responses.
- Legacy backend surfaces for goals, productivity, and hours are still present in the API, but they are retired from the live frontend product flow.
- Some UI actions remain presentation-only in the current frontend, including manager-side employee creation and profile photo controls. Backend support exists for employee creation and URL-based avatar updates, but those specific UI controls are not wired yet; binary photo upload is not implemented.

See [frontend/README.md](frontend/README.md) for the frontend structure, features, and local run instructions.

## Backend Stack

- Node.js 22 LTS
- Express 5
- Supabase PostgreSQL
- Supabase Auth wrapped by backend endpoints
- Zod for validation
- Vitest + Supertest for testing
- Render for deployment

## Current Backend Status

The backend foundation from Phases 0-9 is still in place, and the live product spine has now been extended through the focused pivot modules:

- durable team memberships with leave/rejoin history
- manager join access generation for team codes and invite links
- employee self-join and self-leave flows
- task CRUD, assignment, reassignment, progress, and completion
- task update history in `task_updates`
- Worker Tracker MVP
- Employee Calendar MVP
- Recurring tasks MVP with real generated task instances
- reusable smoke/audit scripts
- Render deployment blueprint
- demo auth user seed script for manual QA
- architecture and integration documentation

Frozen legacy backend surfaces still exist for compatibility, but they are no longer part of the live product experience or any active frontend dependency:

- hours logging
- productivity metrics
- goals and quotas

## Quick Start

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
python3 -m http.server 5500
```

Then open `http://localhost:5500`.

Run backend tests:

```bash
cd backend
npm test
```

Seed a repeatable live demo dataset:

```bash
cd backend
npm run seed:demo-group
```

Demo accounts:

- `manager.demo@cloudcomputing.local`
- `employee.one@cloudcomputing.local`
- `employee.two@cloudcomputing.local`

The demo password is controlled by `DEMO_USER_PASSWORD` in the local backend `.env`.

## Key Backend Docs

- [Project overview](backend/docs/PROJECT_OVERVIEW.md)
- [Backend architecture](backend/docs/BACKEND_ARCHITECTURE.md)
- [Development roadmap](backend/docs/DEVELOPMENT_ROADMAP.md)
- [Module progress board](backend/docs/MODULE_PROGRESS.md)
- [Database schema](backend/docs/DATABASE_SCHEMA.md)
- [Environment variables](backend/docs/ENVIRONMENT_VARIABLES.md)
- [Testing strategy](backend/docs/TESTING_STRATEGY.md)
- [Auth and RBAC](backend/docs/AUTH_AND_RBAC.md)
- [API reference](backend/docs/API_REFERENCE.md)
- [API examples](backend/docs/API_EXAMPLES.md)
- [Frontend integration guide](backend/docs/FRONTEND_INTEGRATION_GUIDE.md)
- [Error handling conventions](backend/docs/ERROR_HANDLING_CONVENTIONS.md)
- [Deployment guide](backend/docs/DEPLOYMENT_GUIDE.md)

## Frontend Integration Notes

The frontend currently uses the following stable backend surface:

- Base API prefix: `/api/v1`
- Health endpoint: `GET /api/v1/health`
- Consistent response envelope for success and error responses
- Database health status appears under `data.database`
- Login endpoint: `POST /api/v1/auth/login`
- Current-user endpoint: `GET /api/v1/auth/me`
- User profile endpoint: `GET /api/v1/users/me`
- Self-profile update endpoint: `PATCH /api/v1/users/me`
- Team list endpoint: `GET /api/v1/teams`
- Team create endpoint: `POST /api/v1/teams`
- Team detail endpoint: `GET /api/v1/teams/:teamId`
- Team update endpoint: `PATCH /api/v1/teams/:teamId`
- Team member endpoint: `GET /api/v1/teams/:teamId/members`
- Team member add endpoint: `POST /api/v1/teams/:teamId/members`
- Team member remove endpoint: `DELETE /api/v1/teams/:teamId/members/:userId`
- Team join access endpoint: `GET /api/v1/teams/:teamId/join-access`
- Team join access regenerate endpoint: `POST /api/v1/teams/:teamId/join-access/regenerate`
- Team self-join endpoint: `POST /api/v1/team-join`
- Team self-leave endpoint: `POST /api/v1/teams/:teamId/members/me/leave`
- Task list endpoint: `GET /api/v1/tasks`
- Task create endpoint: `POST /api/v1/tasks`
- Task detail endpoint: `GET /api/v1/tasks/:taskId`
- Task update endpoint: `PATCH /api/v1/tasks/:taskId`
- Task delete endpoint: `DELETE /api/v1/tasks/:taskId`
- Task assignment endpoint: `POST /api/v1/task-assignments`
- Manager dashboard endpoint: `GET /api/v1/dashboards/manager`
- Worker Tracker endpoint: `GET /api/v1/worker-tracker`
- Recurring task rule create endpoint: `POST /api/v1/recurring-task-rules`
- Notifications endpoint: `GET /api/v1/notifications`
- Notification read endpoint: `PATCH /api/v1/notifications/:notificationId/read`
- Notification dismiss endpoint: `DELETE /api/v1/notifications/:notificationId`

Legacy frozen endpoints for hours, productivity, and goals still exist in the backend, but they are no longer part of the promoted frontend product flow.

Frontend handoff items that still need backend support if the team wants them to become real features:

- binary employee profile photo upload and management
- richer team directory contact information where missing from roster responses

Frontend handoff items that have backend support but still need UI wiring:

- employee creation from the manager UI through `POST /api/v1/users`
- URL-based avatar updates from manager screens through `PATCH /api/v1/users/:userId/avatar`
