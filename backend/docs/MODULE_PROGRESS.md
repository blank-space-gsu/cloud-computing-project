# Module Progress

Last updated: April 19, 2026

> Note:
> This board preserves the original backend delivery history. The current live product has been narrowed to the focused task-flow spine; hours logging, productivity metrics, and goals remain historical/frozen backend surfaces rather than promoted user-facing product areas.

## Phase Board

| Phase | Status | Verification | Frontend impact | Notes |
| --- | --- | --- | --- | --- |
| Phase 0 - Foundation | Complete | `npm test` passed on March 25, 2026 | Frontend can rely on `/api/v1` and `GET /api/v1/health` plus the shared response envelope | Health route, error handling, docs, and backend skeleton are in place |
| Phase 1 - Core DB + env | Complete | `npm test` passed and `supabase db push` succeeded on March 26, 2026 | Frontend can rely on stable entity names for users, teams, tasks, and assignments, plus health database readiness metadata | MVP schema docs, SQL DDL, env parsing, DB utilities, and remote migration are in place |
| Phase 2 - Auth + RBAC | Complete | `npm test`, `supabase db push`, demo seed, and live auth smoke checks all succeeded on March 26, 2026 | Frontend can now build login, current-user loading, and role-aware navigation | Backend-managed auth endpoints, token verification, RBAC middleware, and demo users are in place |
| Phase 3 - Users + teams | Complete | `npm test` and live users/teams smoke checks succeeded on March 25, 2026 | Frontend can now load the authenticated user profile, team lists, team detail, and employee rosters | Team scope rules are enforced in services and repositories |
| Phase 4 - Tasks + assignment | Complete | `npm test` passed with task coverage and live task CRUD plus assignment verification succeeded on March 26, 2026 | Frontend can now build the core manager assignment flow and employee task list/status UI | Task filtering, urgency sorting, and assignment history are in place |
| Phase 5 - MVP dashboards | Complete | `npm test` passed with dashboard coverage and live dashboard verification succeeded on March 26, 2026 | Frontend can now build employee and manager dashboard cards and charts | MVP backend scope is now demo-ready |
| Phase 6 - Hours logging | Complete | `npm test` passed, `supabase db push` succeeded, and live hours logging verification succeeded on March 26, 2026 | Frontend can now build hours entry forms and team-scoped hours summaries | Hours create/list endpoints, summaries, and schema are in place |
| Phase 7 - Productivity metrics | Complete | `npm test` passed and live productivity metrics verification succeeded on March 26, 2026 | Frontend can now build richer productivity rollups, trends, and team comparison charts | Weekly, monthly, and yearly rollups plus chart-ready trend data are in place |
| Phase 8 - Goals and quotas | Complete | `npm test` passed, `supabase db push` succeeded, and live goals verification succeeded on March 26, 2026 | Frontend can now build quota progress cards, goal lists, and manager goal-management forms | Generic goals schema and sales quota support are in place |
| Phase 9 - Hardening + deployment | Complete | `npm test` passed, smoke verification succeeded, and deployment artifacts were added on March 26, 2026 | Frontend can now receive a deployment-ready backend handoff with a stable OCI deployment path and a documented fallback blueprint | Smoke script, deployment guide, OCI rollout workflow, and legacy Render blueprint are in place |
| Phase 10 - Frontend support extensions | Complete | `npm test` passed with 192/192 tests on April 19, 2026 | Frontend can now save profile edits, create employees and teams, and manage memberships with richer roster cards | Avatar support is URL-based, and notifications have been retired from the current live product surface |

## Current Stable Backend Contracts

These items are safe for the frontend team to build against now:

- API prefix: `/api/v1`
- health endpoint: `GET /api/v1/health`
- health payload includes `data.database.status`
- login endpoint: `POST /api/v1/auth/login`
- current-user endpoint: `GET /api/v1/auth/me`
- manager-role verification endpoint: `GET /api/v1/auth/manager-access`
- self-profile update endpoint: `PATCH /api/v1/users/me`
- people directory endpoint: `GET /api/v1/users`
- employee creation endpoint: `POST /api/v1/users`
- avatar update endpoint: `PATCH /api/v1/users/:userId/avatar`
- team create endpoint: `POST /api/v1/teams`
- team update endpoint: `PATCH /api/v1/teams/:teamId`
- team membership add endpoint: `POST /api/v1/teams/:teamId/members`
- team membership remove endpoint: `DELETE /api/v1/teams/:teamId/members/:userId`
- task list endpoint: `GET /api/v1/tasks`
- task create endpoint: `POST /api/v1/tasks`
- task detail endpoint: `GET /api/v1/tasks/:taskId`
- task update endpoint: `PATCH /api/v1/tasks/:taskId`
- task delete endpoint: `DELETE /api/v1/tasks/:taskId`
- task assignment endpoint: `POST /api/v1/task-assignments`
- employee dashboard endpoint: `GET /api/v1/dashboards/employee`
- manager dashboard endpoint: `GET /api/v1/dashboards/manager`
- hours logged list endpoint: `GET /api/v1/hours-logged`
- hours logged create endpoint: `POST /api/v1/hours-logged`
- productivity metrics endpoint: `GET /api/v1/productivity-metrics`
- goals endpoint: `GET /api/v1/goals`
- goal create endpoint: `POST /api/v1/goals`
- goal update endpoint: `PATCH /api/v1/goals/:goalId`
- success envelope:

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {}
}
```

- error envelope:

```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": []
  },
  "meta": {}
}
```

## Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, and Phase 9 Acceptance Snapshot

Phases 0, 1, 2, 3, 4, 5, 6, 7, 8, and 9 are complete because:

- backend service structure exists in `/backend`
- required docs were created and aligned with implementation
- health route test coverage is present
- missing routes return structured JSON errors
- the app is importable for tests without binding a listening port
- environment parsing and database health tests pass
- MVP schema SQL exists in both `sql/` and Supabase migration form
- the linked Supabase project has the Phase 1 migration applied
- auth route, auth service, and RBAC tests pass
- the linked Supabase project has the Phase 2 auth profile sync migration applied
- demo manager and employee users were seeded successfully
- live login and authorization checks succeeded against the running API
- `/users/me` endpoint is implemented and covered by integration tests
- `/teams`, `/teams/:teamId`, and `/teams/:teamId/members` are implemented and covered by tests
- team scope rules are enforced for employees, managers, and admins through the service and repository layers
- `/tasks`, `/tasks/:taskId`, and `/task-assignments` are implemented and covered by tests
- managers can create, update, delete, and assign tasks within manageable teams
- employees can only access actively assigned tasks and can only update status, progress, and notes
- task filtering, pagination metadata, and urgency-oriented sorting are implemented
- `/dashboards/employee` and `/dashboards/manager` are implemented and covered by tests
- dashboard responses include chart-ready workload, status, and priority aggregates
- live seeded task activity was verified against dashboard summaries
- hardening pass added stronger bad-request handling, stricter Monday date validation for task weeks, safer `/auth/me` output, and additional edge-case coverage
- `hours_logged` schema exists in both `sql/` and Supabase migration form
- `/hours-logged` create and list endpoints are implemented and covered by tests
- employee hours logging is restricted to the authenticated user
- manager hours visibility is limited to manageable teams
- hours list responses include weekly and monthly summary totals plus chart-ready daily totals
- `/productivity-metrics` is implemented and covered by tests
- weekly, monthly, and yearly productivity rollups are computed from tasks and hours without changing the schema
- productivity responses include chart-ready weekly and monthly trends
- team productivity responses include a monthly per-member breakdown for comparison views
- employee, manager, and manager-selected-user scope rules are enforced through the service layer
- `goals` schema exists in both `sql/` and Supabase migration form
- `/goals` list, create, and update endpoints are implemented and covered by tests
- sales quota support ships as the first goal type on a generic goals model
- employee goal visibility is limited to team goals and user goals assigned to that employee
- manager goal writes are limited to teams they manage
- goal responses include computed progress percentage, remaining value, excess value, and target-met state
- the OCI deployment workflow and smoke-check path are documented for the live backend
- `render.yaml` remains at the repo root as a legacy alternative deployment blueprint
- `backend/scripts/smoke-test.js` exists for local and deployed smoke verification
- `TESTING_STRATEGY.md` and `DEPLOYMENT_GUIDE.md` are now part of the handoff docs
- `users` profile data now includes `date_of_birth`, `address`, and URL-based `avatar_url`
- `/users/me` now supports self-service profile edits for safe profile-only fields
- `/users` now supports people-directory reads and manager/admin employee creation
- `/users/:userId/avatar` now supports manager/admin URL-based avatar updates
- `/teams` now supports real team creation and editing
- `/teams/:teamId/members` now supports persisted membership add/remove operations
- the current regression suite passed with `192/192` tests on April 19, 2026

## Next Recommended Phase

The planned roadmap is complete. Recommended optional next work:

- task comments and activity history
- richer scheduled/email reminder delivery
- attachments
- export-ready reporting
