# Cloud-Based Workforce Task Management System

University cloud computing project for a workforce task management web application. The repository is organized as a simple monorepo so the backend and frontend teams can work in parallel without mixing concerns.

## Project Overview

The application helps managers assign and monitor work while giving employees a clear view of what they need to complete. The backend is implemented as a modular REST API, and the frontend is a plain HTML, CSS, and JavaScript single-page app that consumes those endpoints without a framework dependency.

### MVP

- Managers can assign tasks to employees.
- Managers can view employee workload and completion progress.
- Employees can view their assigned tasks and update task status.
- Teams, due dates, priorities, and weekly task organization are supported.

### Optional Next Enhancements

- task comments and activity history
- file attachments
- notifications and reminders
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
- Manager dashboard with task, hour, goal, and productivity summaries
- Employee dashboard with personal tasks, hour logging, goals, and performance views
- Tasks, goals, productivity, hours, teams, and profile pages
- Team directory and people views
- Manager and employee profile pages
- Frontend-only profile edit preview for personal info fields
- Responsive TaskFlow-styled UI using shared components and hash-based routing

Frontend notes:

- The frontend work was kept separate from backend source changes.
- Local demo data is shown through the existing backend seed scripts and API responses, not through new backend code in this branch.
- Some UI actions are intentionally presentation-only until backend support exists, including employee creation and profile photo management.

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

Phases 0, 1, 2, 3, 4, 5, 6, 7, 8, and 9 are implemented in `/backend`:

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
- goals and quota tracking endpoints
- reusable smoke-check script
- Render deployment blueprint
- Demo auth user seed script for manual QA
- Phase roadmap and architecture documentation

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
- Goals endpoint: `GET /api/v1/goals`
- Goal create endpoint: `POST /api/v1/goals`
- Goal update endpoint: `PATCH /api/v1/goals/:goalId`

The planned backend roadmap is now complete. Future enhancements can continue using the same response conventions so the frontend team can keep reusing one shared `fetch()` helper.

Frontend handoff items that still need backend support if the team wants them to become real features:

- employee creation from the manager UI
- employee profile photo upload and management
- editable self-profile save flow for name, job title, date of birth, and address
- richer team directory contact information where missing from roster responses
