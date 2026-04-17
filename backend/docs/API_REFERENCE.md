# API Reference

Current API base URL prefix: `/api/v1`

## Response Format

### Success

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {}
}
```

### Error

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

## Health

### `GET /api/v1/health`

**Purpose**
Checks whether the backend is running and reports database readiness.

**Auth**
No authentication required.

**Request body**
None.

**Success response**

```json
{
  "success": true,
  "message": "Backend service is healthy.",
  "data": {
    "status": "ok",
    "service": "workforce-task-management-backend",
    "environment": "development",
    "uptimeSeconds": 12.34,
    "version": "0.1.0",
    "database": {
      "status": "connected"
    }
  },
  "meta": {
    "timestamp": "2026-03-26T04:00:00.000Z",
    "path": "/api/v1/health",
    "method": "GET"
  }
}
```

## Auth

### `POST /api/v1/auth/login`

**Purpose**
Authenticates a user with Supabase Auth and returns tokens plus the app profile.

**Auth**
No authentication required.

**Request body**

```json
{
  "email": "manager.demo@cloudcomputing.local",
  "password": "example-password"
}
```

**Validation**

- `email` must be a valid email address
- `password` must be at least 6 characters

**Success response**

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "session": {
      "accessToken": "jwt",
      "refreshToken": "refresh-token",
      "tokenType": "bearer",
      "expiresIn": 3600,
      "expiresAt": "2026-03-26T05:00:00.000Z"
    },
    "user": {
      "id": "uuid",
      "email": "manager.demo@cloudcomputing.local",
      "firstName": "Maya",
      "lastName": "Manager",
      "fullName": "Maya Manager",
      "jobTitle": "Operations Manager",
      "dateOfBirth": null,
      "address": null,
      "avatarUrl": null,
      "appRole": "manager",
      "isActive": true,
      "teams": [
        {
          "teamId": "uuid",
          "teamName": "Operations Team",
          "membershipRole": "manager"
        }
      ],
      "auth": {
        "emailConfirmedAt": "2026-03-26T04:00:00.000Z",
        "lastSignInAt": "2026-03-26T04:05:00.000Z"
      }
    }
  },
  "meta": {
    "timestamp": "2026-03-26T04:05:00.000Z"
  }
}
```

**Error codes**

- `400 VALIDATION_ERROR`
- `400 INVALID_JSON`
- `401 INVALID_CREDENTIALS`
- `403 ACCOUNT_NOT_PROVISIONED`
- `403 ACCOUNT_DISABLED`
- `503 AUTH_CONFIGURATION_MISSING`

### `GET /api/v1/auth/me`

**Purpose**
Returns the authenticated application user and role/team context.

**Auth**
Bearer token required.

**Headers**

```text
Authorization: Bearer <access-token>
```

**Success response**

Returns the same `user` payload shape created during login, wrapped in the standard success envelope.

**Error codes**

- `401 UNAUTHORIZED`
- `403 ACCOUNT_NOT_PROVISIONED`
- `403 ACCOUNT_DISABLED`

### `GET /api/v1/auth/manager-access`

**Purpose**
Protected manager-only RBAC verification endpoint.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Success response**

```json
{
  "success": true,
  "message": "Manager access confirmed.",
  "data": {
    "role": "manager"
  },
  "meta": {
    "timestamp": "2026-03-26T04:10:00.000Z"
  }
}
```

**Error codes**

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

## Users

### `GET /api/v1/users/me`

**Purpose**
Returns the authenticated application profile in the users module namespace.

**Auth**
Bearer token required.

**Success response**

```json
{
  "success": true,
  "message": "Current user profile loaded successfully.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "manager.demo@cloudcomputing.local",
      "firstName": "Maya",
      "lastName": "Manager",
      "fullName": "Maya Manager",
      "jobTitle": "Operations Manager",
      "dateOfBirth": null,
      "address": null,
      "avatarUrl": null,
      "appRole": "manager",
      "isActive": true,
      "teams": []
    }
  },
  "meta": {
    "timestamp": "2026-03-26T04:20:00.000Z"
  }
}
```

### `PATCH /api/v1/users/me`

**Purpose**
Allows the authenticated user to update their own profile-only fields.

**Editable fields**

- `firstName`
- `lastName`
- `jobTitle`
- `dateOfBirth`
- `address`

**Notes**

- `appRole`, `email`, `avatarUrl`, and `isActive` are not self-editable here
- `dateOfBirth` must use `YYYY-MM-DD` and cannot be in the future

### `GET /api/v1/users`

**Purpose**
Manager/admin people-directory endpoint for team-management flows.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Query params**

- `role` optional, such as `employee`
- `teamId` optional
- `search` optional
- `includeInactive` optional, defaults to `false`

### `POST /api/v1/users`

**Purpose**
Manager/admin employee creation flow that creates the Supabase auth user, application profile, and initial team membership.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Notes**

- the backend always creates these records with `appRole = employee`
- managers can only create employees for teams they manage
- `avatarUrl` is stored as a URL string, not a binary upload

### `PATCH /api/v1/users/:userId/avatar`

**Purpose**
Manager/admin avatar update endpoint for URL-based profile photos.

**Auth**
Bearer token required, role must be `manager` or `admin`.

## Teams

### `GET /api/v1/teams`

**Purpose**
Lists the teams visible to the authenticated user.

**Auth**
Bearer token required.

**Scope**

- employees see only teams they belong to
- managers see teams they belong to
- admins can see all teams

**Success response**

```json
{
  "success": true,
  "message": "Teams loaded successfully.",
  "data": {
    "teams": [
      {
        "id": "uuid",
        "name": "Operations Team",
        "description": "Demo team for manager and employee authentication checks.",
        "membershipRole": "manager",
        "memberCount": 3,
        "managerCount": 1,
        "canManageTeam": true,
        "createdAt": "2026-03-26T04:00:00.000Z",
        "updatedAt": "2026-03-26T04:00:00.000Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-26T04:20:00.000Z",
    "count": 1
  }
}
```

### `POST /api/v1/teams`

**Purpose**
Creates a persisted team record.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Notes**

- the creating manager/admin is automatically added to the team with `membershipRole = manager`

### `PATCH /api/v1/teams/:teamId`

**Purpose**
Updates a team name and/or description for a manageable team.

**Auth**
Bearer token required, role must be `manager` or `admin`.

### `GET /api/v1/teams/:teamId`

**Purpose**
Loads a single team within the authenticated user’s visible scope.

**Auth**
Bearer token required.

**Validation**

- `teamId` must be a valid UUID

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 TEAM_NOT_FOUND`

### `GET /api/v1/teams/:teamId/members`

**Purpose**
Loads the member roster for a team within the authenticated user’s visible scope.

**Auth**
Bearer token required.

**Response notes**

- returns basic teammate information for dashboard roster views
- avoids exposing productivity or private HR-style details

**Success response**

```json
{
  "success": true,
  "message": "Team members loaded successfully.",
  "data": {
    "team": {
      "id": "uuid",
      "name": "Operations Team",
      "canManageTeam": true
    },
    "members": [
      {
        "id": "uuid",
        "email": "manager.demo@cloudcomputing.local",
        "firstName": "Maya",
        "lastName": "Manager",
        "fullName": "Maya Manager",
        "jobTitle": "Operations Manager",
        "avatarUrl": null,
        "appRole": "manager",
        "membershipRole": "manager",
        "isActive": true
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-26T04:20:00.000Z",
    "count": 3
  }
}
```

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 TEAM_NOT_FOUND`

### `POST /api/v1/teams/:teamId/members`

**Purpose**
Adds a team membership that persists in `team_members`.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Notes**

- duplicate memberships return `409 TEAM_MEMBERSHIP_EXISTS`
- previously left or removed memberships are reactivated instead of creating a second history row
- non-admin managers can only add regular members
- a `team_added` notification is created immediately for the added user

### `GET /api/v1/teams/:teamId/join-access`

**Purpose**
Returns the current manager-facing join code and invite link for a manageable team.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Notes**

- if the team has no active join access yet, the backend generates the current pair lazily
- join access only creates employee/member memberships

### `POST /api/v1/teams/:teamId/join-access/regenerate`

**Purpose**
Revokes the current join code and invite link for a manageable team and returns a fresh pair.

**Auth**
Bearer token required, role must be `manager` or `admin`.

### `DELETE /api/v1/teams/:teamId/members/:userId`

**Purpose**
Removes an active team membership without deleting historical membership state.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Notes**

- non-admin managers can remove regular members from teams they manage
- manager membership removal remains admin-only
- teams must retain at least one manager
- members with active open assignments in that team cannot be removed yet

### `POST /api/v1/teams/:teamId/members/me/leave`

**Purpose**
Allows an employee to leave an active team membership while preserving historical membership state.

**Auth**
Bearer token required, role must be `employee`.

**Notes**

- only active employee/member memberships can be left through this route
- employees with active open assignments in that team receive `400 TEAM_LEAVE_BLOCKED_OPEN_ASSIGNMENTS`
- leaving removes the team from active roster views but preserves past membership and assignment history

### `POST /api/v1/team-join`

**Purpose**
Allows an authenticated employee to join a team using either a join code or an invite token.

**Auth**
Bearer token required, role must be `employee`.

**Request body**

Provide exactly one of:

- `joinCode`
- `inviteToken`

**Notes**

- active memberships return `409 TEAM_MEMBERSHIP_EXISTS`
- prior `left` memberships are reactivated and return the rejoin success message
- prior `removed` memberships cannot self-reactivate in this slice
- revoked or expired join access is rejected cleanly

## Frontend Integration Notes

- Store `accessToken` and `refreshToken` returned by login.
- Send `Authorization: Bearer <accessToken>` on protected requests.
- Use `appRole` from the login or `/auth/me` response to branch the UI between employee and manager experiences.
- Use `/users/me` when the frontend wants a user-centric route namespace.
- Use `PATCH /users/me` for self-service profile editing.
- Use `GET /users` for manager/admin people pickers and directory search.
- Use `PATCH /users/:userId/avatar` for manager/admin avatar URL updates.
- Use `/teams` and `/teams/:teamId/members` to build team selectors and active roster cards.
- Use `/teams/:teamId/join-access` and `/teams/:teamId/join-access/regenerate` for manager-facing join code and invite-link controls.
- Use `/team-join` for employee self-join onboarding and `/teams/:teamId/members/me/leave` for self-leave.
- Team roster payloads now include `email`, `avatarUrl`, and `isActive`.
- Use `/tasks` for task lists, filtering, and urgency sorting.
- Use `/task-assignments` for manager-driven assignment actions.
- Use `/notifications` for persistent backend-backed notifications.
- Expect all API errors to be JSON, not HTML.

## Notifications

### `GET /api/v1/notifications`

**Purpose**
Returns persistent notifications for the authenticated user plus an unread count.

**Auth**
Bearer token required.

**Response notes**

- `data.notifications` is the current page of notifications
- `data.unreadCount` counts unread and not-dismissed items across the user’s notification set
- due-soon and overdue task alerts are generated lazily when this endpoint is read and are then persisted with deduping

### `PATCH /api/v1/notifications/:notificationId/read`

**Purpose**
Marks a notification as read for the authenticated user.

### `DELETE /api/v1/notifications/:notificationId`

**Purpose**
Soft-dismisses a notification for the authenticated user by setting `dismissedAt`.

## Tasks

### `GET /api/v1/tasks`

**Purpose**
Lists tasks visible to the authenticated user.

**Auth**
Bearer token required.

**Scope**

- employees only receive tasks actively assigned to them
- managers receive tasks for teams they manage
- admins receive all tasks

**Query params**

- `page`
- `limit`
- `teamId`
- `assigneeUserId`
- `status`
- `priority`
- `weekStartDate`
- `dateFrom`
- `dateTo`
- `includeCompleted`
- `sortBy` with `urgency`, `dueAt`, `priority`, `createdAt`, or `weekStartDate`
- `sortOrder` with `asc` or `desc`

**Success notes**

- returns `meta.count`, `meta.total`, `meta.page`, and `meta.limit`
- each task includes computed `timeRemainingSeconds`, `isOverdue`, and `isDueSoon`
- active assignee data appears under `task.assignment`
- `dateFrom` and `dateTo` filter by the task `dueAt` calendar date and are useful for employee calendar views

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`

### `POST /api/v1/tasks`

**Purpose**
Creates a task for a manageable team.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Request body**

```json
{
  "teamId": "uuid",
  "title": "Prepare weekly client report",
  "description": "Compile sales updates and blockers.",
  "notes": "Use the latest template.",
  "priority": "high",
  "dueAt": "2026-03-28T17:00:00.000Z",
  "weekStartDate": "2026-03-23",
  "estimatedHours": 3.5,
  "progressPercent": 0
}
```

**Validation**

- `teamId` must be a valid UUID
- `title` must not be blank
- `weekStartDate` must be an ISO date string for a Monday
- `priority` must match the supported enum values
- `dueAt` must be an ISO datetime with timezone when provided
- `estimatedHours` must be `0` or greater
- `progressPercent` must be between `0` and `100`

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 TASK_CREATION_FORBIDDEN`
- `403 TEAM_MANAGEMENT_FORBIDDEN`
- `404 TEAM_NOT_FOUND`

## Recurring Task Rules

### `POST /api/v1/recurring-task-rules`

**Purpose**
Creates a recurring task rule for a manageable team. The rule generates real task instances that flow through Tasks, Worker Tracker, My Tasks, and Calendar as normal tasks.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Request body**

```json
{
  "teamId": "uuid",
  "title": "Daily shift handoff",
  "description": "Post the handoff notes before the morning review.",
  "priority": "high",
  "defaultAssigneeUserId": "uuid",
  "frequency": "weekly",
  "weekdays": [1, 3, 5],
  "dueTime": "09:00",
  "startsOn": "2026-04-20",
  "endsOn": "2026-05-31"
}
```

**Validation**

- `teamId` must be a valid UUID
- `title` must not be blank
- `frequency` must be `daily`, `weekly`, or `monthly`
- `dueTime` must use `HH:MM` 24-hour format
- `startsOn` and `endsOn` must use `YYYY-MM-DD`
- weekly rules require one or more `weekdays` values (`0-6`)
- monthly rules require `dayOfMonth` (`1-31`)

**Notes**

- this MVP intentionally supports only:
  - daily
  - weekly on one or more weekdays
  - monthly on a day-of-month
- generated task instances are real task rows, not virtual recurrence views
- advanced recurrence features remain out of scope in this slice

### `GET /api/v1/tasks/:taskId`

**Purpose**
Loads a single task within the authenticated user’s scope.

**Auth**
Bearer token required.

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 TASK_NOT_FOUND`

### `PATCH /api/v1/tasks/:taskId`

**Purpose**
Updates an accessible task.

**Auth**
Bearer token required.

**Scope rules**

- managers and admins can update full task details for manageable tasks
- employees can only update `status`, `progressPercent`, and `notes` on their own assigned tasks

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 TASK_UPDATE_FORBIDDEN`
- `404 TASK_NOT_FOUND`

### `DELETE /api/v1/tasks/:taskId`

**Purpose**
Deletes a manageable task.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 TASK_DELETION_FORBIDDEN`
- `404 TASK_NOT_FOUND`

## Task Assignments

### `POST /api/v1/task-assignments`

**Purpose**
Assigns or reassigns a task to an employee while preserving assignment history.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Request body**

```json
{
  "taskId": "uuid",
  "assigneeUserId": "uuid",
  "assignmentNote": "Finish before Friday review."
}
```

**Validation**

- `taskId` must be a valid UUID
- `assigneeUserId` must be a valid UUID
- `assignmentNote` is optional

**Error codes**

- `400 VALIDATION_ERROR`
- `400 INVALID_ASSIGNEE_ROLE`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 TASK_ASSIGNMENT_FORBIDDEN`
- `404 TASK_NOT_FOUND`
- `404 ASSIGNEE_NOT_FOUND`

## Dashboards

### `GET /api/v1/dashboards/employee`

**Purpose**
Returns the employee dashboard summary for the authenticated employee.

**Auth**
Bearer token required, role must be `employee`.

**Response notes**

- task counts are scoped to the logged-in employee's active assignments
- chart arrays are ready for frontend status, priority, and weekly distribution widgets
- task preview sections include upcoming deadlines and urgent tasks

**Error codes**

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 EMPLOYEE_DASHBOARD_FORBIDDEN`

### `GET /api/v1/dashboards/manager`

**Purpose**
Returns the manager dashboard summary for manageable teams.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Query params**

- `teamId` optional UUID to narrow the dashboard to one manageable team

**Response notes**

- `data.teams` lists the manageable teams included in the response
- `data.summary` contains top-level workload and completion counts
- `data.charts.workloadByEmployee` is chart-ready per-employee workload data
- `data.tasks.upcomingDeadlines` and `data.tasks.urgentTasks` provide dashboard card data

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 TEAM_NOT_FOUND`

## Worker Tracker

### `GET /api/v1/worker-tracker`

**Purpose**
Returns a manager-first tracker view built from teams, active memberships, tasks, assignments, and task updates.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Query params**

- `teamId` optional UUID to select one manageable team
- `memberUserId` optional UUID to drill into one active employee in the selected team

**Response notes**

- `data.availableTeams` lists the manageable teams available to the signed-in manager
- `data.team` and `data.summary` provide the selected team’s completion, open, completed, overdue, blocked, and unassigned counts
- `data.members` provides calm employee-level progress rows with completion, open, overdue, and blocked counts
- `data.tasks` contains the selected employee’s active assigned tasks
- `data.unassignedTasks` contains a short list of open tasks in the selected team that still need an assignee
- task drill-down rows include `latestUpdate` data sourced from `task_updates`

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `404 TEAM_NOT_FOUND`
- `404 TEAM_MEMBER_NOT_FOUND`

## Hours Logged

### `GET /api/v1/hours-logged`

**Purpose**
Returns hours log entries within the authenticated user scope plus weekly and monthly summaries.

**Auth**
Bearer token required.

**Scope rules**

- employees only receive their own hours logs
- managers receive hours logs for teams they manage
- admins receive all hours logs

**Query params**

- `page`
- `limit`
- `teamId`
- `taskId`
- `userId`
- `dateFrom`
- `dateTo`
- `sortBy` with `workDate`, `createdAt`, or `hours`
- `sortOrder` with `asc` or `desc`

**Response notes**

- `data.summary.totalHours` reports the total hours in the filtered scope
- `data.summary.currentWeekHours` reports the current-week total in the filtered scope
- `data.summary.currentMonthHours` reports the current-month total in the filtered scope
- `data.charts.byDate` is chart-ready daily hours aggregation

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 TEAM_NOT_FOUND`

### `POST /api/v1/hours-logged`

**Purpose**
Creates a new hours log entry for the authenticated user.

**Auth**
Bearer token required.

**Request body**

```json
{
  "teamId": "uuid",
  "taskId": "uuid",
  "workDate": "2026-03-26",
  "hours": 3.5,
  "note": "Wrapped up the weekly reporting block."
}
```

**Validation**

- `teamId` must be a valid UUID
- `taskId` is optional but must be a valid UUID when provided
- `workDate` must be a real ISO calendar date
- `hours` must be greater than `0`, less than or equal to `24`, and use at most 2 decimal places
- `note` is optional and capped at 2000 characters

**Error codes**

- `400 VALIDATION_ERROR`
- `400 HOURS_TASK_TEAM_MISMATCH`
- `401 UNAUTHORIZED`
- `404 TEAM_NOT_FOUND`
- `404 TASK_NOT_FOUND`

## Productivity Metrics

### `GET /api/v1/productivity-metrics`

**Purpose**
Returns role-aware productivity analytics built from task and hours data.

**Auth**
Bearer token required.

**Scope rules**

- employees can only access their own individual productivity metrics
- managers can access team productivity for manageable teams
- managers can access individual productivity for users inside manageable teams
- admins can access team or individual productivity across the application

**Query params**

- `scope` with `individual` or `team`
- `teamId` optional UUID to narrow the metrics to a specific accessible or manageable team
- `userId` optional UUID for `individual` scope
- `referenceDate` optional ISO date used to anchor the weekly, monthly, and yearly rollups

**Response notes**

- `data.rollups.weekly`, `data.rollups.monthly`, and `data.rollups.yearly` all use the same metric shape
- each rollup includes task counts, completed counts, open counts, logged hours, completion rate, and logged-vs-estimated percentage
- `data.charts.weeklyTrend` and `data.charts.monthlyTrend` are chart-ready trend series
- `data.breakdown.members` is populated for team scope and is designed for team comparison tables or bar charts
- `data.availableTeams` provides the team filter options the current user can legitimately use for this endpoint

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 PRODUCTIVITY_SCOPE_FORBIDDEN`
- `404 TEAM_NOT_FOUND`
- `404 USER_NOT_FOUND`

## Goals

### `GET /api/v1/goals`

**Purpose**
Returns goal and quota records visible to the authenticated user plus summary metadata for the current filter.

**Auth**
Bearer token required.

**Scope rules**

- employees receive team-scoped goals for their teams plus user-scoped goals assigned to them
- managers receive goals for teams they manage
- admins receive all goals

**Query params**

- `page`
- `limit`
- `teamId`
- `userId`
- `goalType`
- `scope`
- `period`
- `status`
- `includeCancelled`
- `sortBy` with `endDate`, `createdAt`, `progressPercent`, `targetValue`, or `title`
- `sortOrder` with `asc` or `desc`

**Response notes**

- `data.summary` includes total counts and unit-aware totals
- `data.summary.totalTargetValue` and `data.summary.totalActualValue` are numeric only when all returned goals share the same unit
- `data.summary.hasMixedUnits` becomes `true` when the filtered result mixes units such as `USD` and `tasks`
- `data.summary.totalsByUnit` provides grouped totals when mixed units are present
- `data.charts.byStatus`, `data.charts.byType`, `data.charts.byPeriod`, and `data.charts.byScope` are chart-ready
- each goal includes computed `progressPercent`, `isTargetMet`, `remainingValue`, and `excessValue`
- `data.availableTeams` provides valid frontend filter options

**Error codes**

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 TEAM_NOT_FOUND`
- `404 USER_NOT_FOUND`

### `POST /api/v1/goals`

**Purpose**
Creates a new team-scoped or user-scoped goal.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Request body**

```json
{
  "teamId": "uuid",
  "targetUserId": "uuid",
  "title": "March sales quota",
  "description": "Close the monthly target.",
  "goalType": "sales_quota",
  "scope": "user",
  "period": "monthly",
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "targetValue": 15000,
  "actualValue": 6000,
  "unit": "USD",
  "status": "active"
}
```

**Validation**

- `teamId` must be a valid UUID
- `targetUserId` is required for `user` scope and must be omitted for `team` scope
- `goalType` currently supports `sales_quota`
- `period` must be one of `weekly`, `monthly`, `quarterly`, or `yearly`
- `startDate` and `endDate` must be real ISO dates with `startDate <= endDate`
- `targetValue` must be greater than `0`
- `actualValue` must be `0` or greater
- `unit` must be a non-empty label such as `USD` or `deals`

**Error codes**

- `400 VALIDATION_ERROR`
- `400 INVALID_GOAL_TARGET_ROLE`
- `400 INVALID_GOAL_CONFIGURATION`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 GOAL_CREATION_FORBIDDEN`
- `403 TEAM_MANAGEMENT_FORBIDDEN`
- `404 TEAM_NOT_FOUND`
- `404 USER_NOT_FOUND`

### `PATCH /api/v1/goals/:goalId`

**Purpose**
Updates an existing goal or quota.

**Auth**
Bearer token required, role must be `manager` or `admin`.

**Update notes**

- managers can update targets, actual values, dates, status, scope, and titles for teams they manage
- switching to `team` scope clears `targetUserId`
- switching to `user` scope requires a valid employee target in the goal team

**Error codes**

- `400 VALIDATION_ERROR`
- `400 INVALID_GOAL_TARGET_ROLE`
- `400 INVALID_GOAL_CONFIGURATION`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`
- `403 GOAL_UPDATE_FORBIDDEN`
- `404 GOAL_NOT_FOUND`
- `404 TEAM_NOT_FOUND`
- `404 USER_NOT_FOUND`
