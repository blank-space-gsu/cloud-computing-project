# Development Roadmap

## Delivery Strategy

The backend is developed in phases so each milestone is planned, implemented, tested, documented, and marked complete before the next phase begins.

## Current Status

- Phase 0 is complete.
- Phase 1 is complete.
- Phase 2 is complete.
- Phase 3 is complete.
- Phase 4 is complete.
- Phase 5 is complete.
- Phase 6 is complete.
- Phase 7 is complete.
- Phase 8 is complete.
- Phase 9 is complete.
- The frontend support extension pass is complete for profile edits, team mutations, employee creation APIs, URL-based avatar support, and backend-backed notifications.
- The MVP schema migration has been applied to the linked Supabase project.
- Demo auth users exist for manual testing.
- The planned backend roadmap is complete.

### MVP Boundary

The MVP ends after Phase 5:

- authentication and RBAC
- users and teams
- task assignment and task status workflows
- employee task view
- manager workload and completion summaries

Later phases extend the product without forcing premature complexity into the MVP.

## Phase 0 - Foundation

**Goal**
Create the backend project skeleton, shared response conventions, health endpoint, and baseline documentation.

**Deliverables**
- repository-aligned backend structure in `/backend`
- Express app bootstrap
- centralized error handling
- reusable API response helper
- `GET /api/v1/health`
- core architecture and roadmap docs

**Dependencies**
- none

**Files involved**
- `README.md`
- `backend/package.json`
- `backend/.env.example`
- `backend/src/app.js`
- `backend/src/server.js`
- `backend/src/routes/health.routes.js`
- `backend/src/controllers/health.controller.js`
- `backend/src/utils/apiResponse.js`
- `backend/src/middleware/errorHandler.js`
- `backend/tests/integration/health.routes.test.js`
- Phase 0 docs in `backend/docs`

**Endpoints involved**
- `GET /api/v1/health`

**Tests required**
- health route happy path
- unknown route error shape
- app import without a bound port

**Docs required**
- project overview
- architecture
- roadmap
- module progress

**Frontend-usable outputs**
- stable API prefix
- stable response envelope
- stable health check endpoint

**Exit criteria**
- app boots
- tests pass
- docs reflect the actual implementation
- module progress is updated to complete

## Phase 1 - Core Database and Environment Configuration

**Goal**
Define the MVP database schema and connect the application to Supabase PostgreSQL safely.

**Deliverables**
- environment validation
- database connection module
- SQL DDL scripts for MVP tables
- schema documentation with constraints and indexes
- optional seed strategy for demo data

**Dependencies**
- Phase 0 complete

**Files involved**
- `backend/src/config/*`
- `backend/src/db/*`
- `backend/sql/*.sql`
- database documentation files

**Endpoints involved**
- existing health endpoint may expose database readiness metadata

**Tests required**
- environment validation
- database connection smoke test
- schema execution sanity check

**Docs required**
- database schema documentation
- environment variables guide

**Frontend-usable outputs**
- stable entity names and field direction for users, teams, and tasks

**Exit criteria**
- DDL runs cleanly against Supabase Postgres
- docs match the SQL

## Phase 2 - Authentication and RBAC

**Goal**
Add login, token verification, current-user lookup, and role-aware access control.

**Deliverables**
- `/auth/login`
- `/auth/me`
- auth middleware
- RBAC middleware
- documented role rules for employee, manager, and admin

**Dependencies**
- Phase 1 complete

**Files involved**
- auth routes, controllers, services, validators, middleware, and docs

**Endpoints involved**
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

**Tests required**
- successful login
- invalid login handling
- protected route unauthorized response
- manager and employee RBAC checks

**Docs required**
- auth and RBAC guide
- API reference updates
- frontend integration updates

**Frontend-usable outputs**
- login flow
- current user loading
- role-aware UI branching

**Exit criteria**
- frontend can authenticate against backend endpoints
- RBAC rules are enforced and tested

## Phase 3 - Users and Teams

**Goal**
Create user profile and team data endpoints needed for assignment flows and manager views.

**Deliverables**
- team listing and detail endpoints
- membership listing
- limited user profile endpoints
- manager-only team visibility rules

**Dependencies**
- Phase 2 complete

**Files involved**
- user and team controllers, services, repositories, validators, and docs

**Endpoints involved**
- `GET /api/v1/users/me`
- `GET /api/v1/teams`
- `GET /api/v1/teams/:teamId`
- `GET /api/v1/teams/:teamId/members`

**Tests required**
- access scope tests
- manager-only team data tests
- validation and not-found tests

**Docs required**
- API reference
- frontend integration guide
- module progress update

**Frontend-usable outputs**
- employee roster for managers
- team list and member list rendering

**Exit criteria**
- team membership and profile APIs are stable

**Completion note**
- completed with authenticated `users/me`, scoped team listing, team detail, and team roster endpoints

## Phase 4 - Task CRUD and Assignment

**Goal**
Implement the core task workflow for the MVP.

**Deliverables**
- task create, update, delete, and list endpoints
- manager task assignment flow
- employee task status updates
- due date, priority, notes, estimated hours, and progress support
- weekly task filters and urgency-oriented sorting

**Dependencies**
- Phase 3 complete

**Files involved**
- task and assignment modules across routes, controllers, services, repositories, validators, and SQL

**Endpoints involved**
- `POST /api/v1/tasks`
- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `POST /api/v1/task-assignments`

**Tests required**
- CRUD happy paths
- manager-only assignment
- employee ownership restrictions
- filtering and sorting
- validation and error-path coverage

**Docs required**
- API reference
- API examples
- frontend integration guide

**Frontend-usable outputs**
- manager assignment screen
- employee task list
- task details and status updates

**Exit criteria**
- core task flows are stable and tested

**Completion note**
- completed with task CRUD, manager task assignment, employee task-status updates, filtering, sorting, and automated coverage

## Phase 5 - MVP Dashboards

**Goal**
Expose the summary endpoints needed for demo-ready employee and manager dashboards.

**Deliverables**
- employee dashboard summary endpoint
- manager dashboard summary endpoint
- chart-ready counts for task status and workload
- deadline and urgency summaries

**Dependencies**
- Phase 4 complete

**Files involved**
- dashboard routes, services, repositories, and docs

**Endpoints involved**
- `GET /api/v1/dashboards/employee`
- `GET /api/v1/dashboards/manager`

**Tests required**
- aggregate correctness
- empty state behavior
- team-scope enforcement

**Docs required**
- frontend integration guide
- API examples
- module progress update

**Frontend-usable outputs**
- employee dashboard widgets
- manager dashboard cards and charts

**Exit criteria**
- MVP is complete and demo-ready

**Completion note**
- completed with employee and manager dashboard summaries, chart-ready aggregates, and deadline-focused task highlights

## Phase 6 - Hours Logging

**Goal**
Add optional time tracking without disturbing the MVP task workflows.

**Deliverables**
- hours log schema
- hours create and list endpoints
- weekly and monthly summaries

**Dependencies**
- MVP complete

**Files involved**
- hours modules and documentation

**Endpoints involved**
- `POST /api/v1/hours-logged`
- `GET /api/v1/hours-logged`

**Tests required**
- own-hours visibility
- manager visibility
- validation and aggregate totals

**Docs required**
- API reference
- testing strategy updates

**Frontend-usable outputs**
- hours form and summary widgets

**Exit criteria**
- hours module is stable and documented

**Completion note**
- completed with hours log schema, self-service hours entry creation, manager/team-scoped hours visibility, and weekly/monthly summary totals

## Phase 7 - Productivity Metrics

**Goal**
Expand from raw tasks and hours into reusable summary analytics.

**Deliverables**
- individual productivity metrics
- team productivity summaries
- weekly, monthly, and yearly rollups

**Dependencies**
- Phase 6 complete

**Files involved**
- productivity modules and documentation

**Endpoints involved**
- `GET /api/v1/productivity-metrics`

**Tests required**
- aggregate correctness
- edge cases for zero-data windows
- scope controls

**Docs required**
- productivity documentation
- API examples

**Frontend-usable outputs**
- richer charts and trend views

**Exit criteria**
- summary metrics are trustworthy and tested

**Completion note**
- completed with a single role-aware productivity metrics endpoint, weekly/monthly/yearly rollups, chart-ready weekly/monthly trends, and team member monthly breakdowns

## Phase 8 - Goals and Quotas

**Goal**
Implement measurable goals with sales quota support as the first goal type.

**Deliverables**
- generic goals schema
- goal progress calculations
- manager-controlled goal assignment

**Dependencies**
- Phase 7 complete

**Files involved**
- goals modules and documentation

**Endpoints involved**
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/:goalId`

**Tests required**
- progress percentage calculations
- validation for target and actual values
- manager-only write access

**Docs required**
- schema and API updates
- frontend integration notes

**Frontend-usable outputs**
- quota progress cards and charts

**Exit criteria**
- goal tracking is consistent with the rest of the API

**Completion note**
- completed with a generic `goals` schema, sales quota support as the first goal type, manager-controlled goal creation and updates, computed progress percentages, and employee-visible team plus personal goals

## Phase 9 - Hardening, QA, and Deployment

**Goal**
Prepare the backend for a reliable demo and student handoff.

**Deliverables**
- final regression pass
- deployment guide
- Render deployment configuration
- demo QA checklist
- polish pass on docs and developer experience

**Dependencies**
- prior phases complete

**Files involved**
- deployment docs, scripts, and cleanup changes

**Endpoints involved**
- no major new endpoints

**Tests required**
- regression suite
- deployment smoke test
- manual QA sign-off

**Docs required**
- deployment guide
- testing strategy
- final module progress update

**Frontend-usable outputs**
- stable deployed API base URL

**Exit criteria**
- backend is deployable, documented, and presentation-ready

**Completion note**
- completed with the final regression pass, reusable smoke-check script, Render deployment Blueprint, deployment guide, testing strategy guide, and final handoff documentation alignment

## Post-Roadmap Backlog

The planned course-project roadmap is complete. If the team wants to keep extending the system, the best next items are:

- task comments and activity history
- file attachments
- scheduled/email reminder delivery beyond the current in-app notification endpoints
- export-ready manager reports
