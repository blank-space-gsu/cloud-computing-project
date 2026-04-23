# Testing Strategy

> Note:
> This testing history includes legacy hours/productivity/goals phases because those backend surfaces still exist. The current live product spine is narrower and focuses on memberships, tasks, Worker Tracker, Teams, Join Team, Calendar, and Profile.

## Purpose

This backend is tested in layers so student teammates can catch bugs early, verify business rules safely, and present the project with confidence.

## Testing Goals

- prove the current REST API works for the MVP and extended reporting modules
- catch regressions when routes, validators, or RBAC rules change
- keep tests readable enough for a student team to maintain
- combine automated verification with practical manual demo checks

## Test Types

### Unit Tests

Used for:

- validators
- utilities
- service-layer business rules
- middleware behavior

Why:

- fastest place to catch validation, authorization, and calculation bugs
- keeps edge-case logic testable without needing a live server

Pass criteria:

- all affected functions return the expected result or throw the expected domain error
- edge cases are covered for invalid input and boundary values

### Integration and Endpoint Tests

Used for:

- Express routes
- request validation
- response envelopes
- auth and RBAC flow

Why:

- proves the frontend-facing contract stays consistent
- catches mistakes between routes, controllers, services, and middleware

Pass criteria:

- expected HTTP status is returned
- response body matches the standard success or error envelope
- scope restrictions are enforced

### Live Smoke Testing

Used for:

- local manual verification after major phases
- post-deploy verification against the live OCI-hosted API
- quick sanity checks against the linked Supabase project

Why:

- confirms the app works outside the test harness
- catches real environment or credential misconfiguration

Pass criteria:

- health endpoint succeeds
- login succeeds when demo credentials are configured
- `/auth/me` succeeds with the returned token
- manager RBAC check matches the configured expectation

### Deep Live Audit

Used for:

- adversarial regression checks against the linked Supabase project
- auth-profile sync verification
- destructive workflow integrity checks
- concurrency and cleanup verification

Why:

- catches real bugs that unit and route tests can miss
- verifies that Supabase auth metadata and `public.users` stay aligned
- exercises delete and reassignment behavior against the real database

Pass criteria:

- temporary auth role changes sync into `public.users`
- admin, manager, and employee scopes behave as expected
- deleting a task preserves hours logs with `taskId = null`
- concurrent assignment attempts leave exactly one active assignment

## Commands

Run from the `backend/` directory.

Automated regression:

```bash
npm test
```

Seed demo users for manual checks:

```bash
npm run seed:demo-users
```

Seed the repeatable demo group and scenario data:

```bash
npm run seed:demo-group
```

Local smoke check:

```bash
npm run smoke:local
```

Deeper live audit against the linked Supabase project:

```bash
npm run audit:local
```

Smoke check against another base URL:

```bash
SMOKE_TEST_BASE_URL=https://api.tasktrail.site \
SMOKE_TEST_EMAIL=manager.demo@cloudcomputing.local \
SMOKE_TEST_PASSWORD=your-demo-password \
SMOKE_TEST_EXPECT_MANAGER_ACCESS=true \
npm run smoke
```

Supabase migration alignment:

```bash
supabase migration list
```

## Module-by-Module Strategy

### Phase 0 - Foundation

What gets tested:

- app bootstrap
- `GET /api/v1/health`
- unknown route handling
- error response envelope

Why it gets tested:

- the whole project depends on a stable app shell and response contract

Sample test cases:

- health returns `200`
- missing route returns structured `404`
- invalid JSON reaches the centralized error handler

Pass criteria:

- API boots cleanly and returns the documented base envelope

### Phase 1 - Database and Environment

What gets tested:

- environment parsing
- database connection health helper
- schema migration application sanity

Why it gets tested:

- almost every feature depends on valid env configuration and correct schema setup

Sample test cases:

- missing optional DB config reports `not_configured`
- configured DB health reports `connected`
- migration files match the documented schema

Pass criteria:

- environment parsing is deterministic and the database can be reached when configured

### Phase 2 - Auth and RBAC

What gets tested:

- login validation
- login failure paths
- token verification middleware
- manager-only authorization

Why it gets tested:

- auth bugs quickly become security bugs or frontend blockers

Sample test cases:

- invalid credentials return `401 INVALID_CREDENTIALS`
- missing token returns `401 UNAUTHORIZED`
- employee access to manager route returns `403 FORBIDDEN`

Pass criteria:

- only authenticated and authorized users can reach protected routes

### Phase 3 - Users and Teams

What gets tested:

- `GET /users/me`
- team visibility scope
- team member roster access
- invalid team IDs and missing team cases

Why it gets tested:

- team scoping is the foundation for manager visibility and employee privacy

Sample test cases:

- employee sees only their own teams
- manager can view roster for a managed team
- unknown team returns `404 TEAM_NOT_FOUND`

Pass criteria:

- team and profile reads respect actor scope every time

### Phase 4 - Tasks and Assignment

What gets tested:

- task create, list, detail, update, and delete
- assignment creation and reassignment
- employee update restrictions
- filter, sort, and pagination behavior

Why it gets tested:

- task workflows are the core MVP functionality

Sample test cases:

- manager creates a task and assigns it to an employee
- employee can update `status`, `progressPercent`, and `notes`
- employee cannot change protected task ownership fields
- impossible `weekStartDate` values are rejected

Pass criteria:

- the manager-to-employee assignment workflow works end to end without scope leaks

### Phase 5 - Dashboards

What gets tested:

- employee dashboard summary
- manager dashboard aggregates
- empty-state behavior

Why it gets tested:

- dashboard bugs are easy to spot in demos and usually come from aggregation mistakes

Sample test cases:

- manager workload counts match seeded tasks
- employee deadline summary excludes other users' tasks
- empty team still returns stable chart-ready arrays

Pass criteria:

- dashboard numbers match the underlying tasks in realistic scenarios

### Phase 6 - Hours Logging

What gets tested:

- hours log creation
- own-hours restrictions
- manager team visibility
- weekly and monthly totals

Why it gets tested:

- time-tracking mistakes create credibility issues in reporting

Sample test cases:

- employee logs hours for themselves successfully
- employee cannot log hours for another user
- team summaries only include scoped records

Pass criteria:

- hours data is scoped correctly and totals are accurate

### Phase 7 - Productivity Metrics

What gets tested:

- weekly, monthly, and yearly rollups
- trend data
- manager-selected employee views
- zero-data windows

Why it gets tested:

- derived metrics are more fragile than raw CRUD endpoints

Sample test cases:

- employee self metrics return only self data
- manager team metrics return breakdowns for manageable teams
- empty time windows return zeros instead of malformed payloads

Pass criteria:

- aggregated metrics remain trustworthy across roles and date windows

### Phase 8 - Goals and Quotas

What gets tested:

- goal creation
- goal updates
- progress calculations
- team-scoped versus user-scoped visibility

Why it gets tested:

- quota logic directly affects manager-facing reporting and demo value

Sample test cases:

- manager creates a user-scoped sales quota
- manager updates `actualValue` and progress recalculates correctly
- employee sees their personal quota and shared team goals
- employee cannot update goals

Pass criteria:

- goal visibility and progress math stay correct across role boundaries

### Phase 9 - Hardening and Deployment

What gets tested:

- full regression suite
- reusable smoke script
- deployment configuration sanity
- manual QA readiness

Why it gets tested:

- the final project should survive both local demos and deployment handoff

Sample test cases:

- `npm test` passes
- `npm run smoke:local` passes against the running API
- Render deployment points to `/api/v1/health`

Pass criteria:

- the repo is deployable and the current roadmap baseline is stable

## Manual QA Checklist

Run this before a demo or final submission:

1. Start the backend and confirm `GET /api/v1/health` returns `200`.
2. Run `npm run seed:demo-group` so the live demo team has fresh tasks, hours, and goals.
3. Log in as the demo manager.
4. Load the manager team list and member roster.
5. Confirm the seeded tasks, hours, and goals appear for the `Physical Demo Group`.
6. Assign or update a task as the manager.
7. Log in as an employee and confirm the assigned task appears.
8. Update the employee task status and progress.
9. Confirm the manager dashboard reflects the seeded and updated workload.
10. Load productivity metrics for both employee and manager views.
11. Load goals and confirm progress percentages render.
12. Rerun `npm run seed:demo-group` whenever you need to reset the demo scenario to a clean, known state.

## Regression Policy

- run `npm test` after any route, service, validator, or RBAC change
- run `supabase migration list` after any schema change
- run `npm run smoke:local` before claiming a phase is deployable
- update the docs in `backend/docs/` in the same change set as the code

## Current Verification Snapshot

As of March 26, 2026:

- the automated regression suite passed with `106/106` tests
- live Phase 8 goal verification passed after real create, list, update, and cleanup checks
- migrations are aligned between local files and the linked Supabase project

This file should be updated when the test workflow or deployment verification flow changes materially.
