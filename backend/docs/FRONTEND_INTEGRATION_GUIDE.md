# Frontend Integration Guide

## What the Frontend Can Build Right Now

Stable today:

- backend health check
- login form
- authenticated current-user loading
- role-aware UI branching for employee vs manager
- user profile loading through `/users/me`
- self-profile editing through `PATCH /users/me`
- manager avatar updates through `PATCH /users/:userId/avatar`
- team list and team roster loading
- team creation and editing
- persistent team membership changes
- people directory loading for manager workflows
- task creation for managers
- task assignment for managers
- employee task list loading
- employee task status and progress updates
- employee dashboard widgets
- manager dashboard cards and charts
- hours logging forms
- hours summary widgets
- productivity summary cards and trend charts
- goals and quota progress widgets
- notification list, read, and dismiss flows
- global loading and error handling based on the shared response envelope

Still in progress:

- binary profile-photo upload infrastructure is not implemented; avatar support is URL-based today
- due-soon task notifications are generated lazily when `/notifications` is read instead of through a background scheduler

## Base API Settings

- base prefix: `/api/v1`
- content type: `application/json`
- auth style: `Authorization: Bearer <access-token>`

## Current Endpoints

| Method | Path | Use now? | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Yes | Useful for startup or API availability checks |
| `POST` | `/api/v1/auth/login` | Yes | Main login form submission endpoint |
| `GET` | `/api/v1/auth/me` | Yes | Load the logged-in user after storing tokens |
| `GET` | `/api/v1/auth/manager-access` | Optional | Manager-role verification endpoint for protected manager UI checks |
| `GET` | `/api/v1/users/me` | Yes | User-profile namespaced endpoint |
| `PATCH` | `/api/v1/users/me` | Yes | Self-editable profile fields: `firstName`, `lastName`, `jobTitle`, `dateOfBirth`, `address` |
| `GET` | `/api/v1/users` | Yes | Manager/admin people directory with optional `role`, `teamId`, `search`, and `includeInactive` filters |
| `POST` | `/api/v1/users` | Yes | Manager/admin employee creation flow with auth user, app profile, and team membership |
| `PATCH` | `/api/v1/users/:userId/avatar` | Yes | Manager/admin avatar URL update endpoint |
| `GET` | `/api/v1/teams` | Yes | Load visible teams for the authenticated user |
| `POST` | `/api/v1/teams` | Yes | Manager/admin team creation endpoint |
| `GET` | `/api/v1/teams/:teamId` | Yes | Load team detail within user scope |
| `PATCH` | `/api/v1/teams/:teamId` | Yes | Manager/admin team update endpoint |
| `GET` | `/api/v1/teams/:teamId/members` | Yes | Load the basic roster for a visible team |
| `POST` | `/api/v1/teams/:teamId/members` | Yes | Manager/admin team membership add endpoint |
| `DELETE` | `/api/v1/teams/:teamId/members/:userId` | Yes | Manager/admin team membership remove endpoint |
| `GET` | `/api/v1/tasks` | Yes | Load scoped task lists with filters and pagination metadata |
| `POST` | `/api/v1/tasks` | Yes | Manager/admin task creation endpoint |
| `GET` | `/api/v1/tasks/:taskId` | Yes | Load task detail within actor scope |
| `PATCH` | `/api/v1/tasks/:taskId` | Yes | Manager full update or employee status/progress update |
| `DELETE` | `/api/v1/tasks/:taskId` | Yes | Manager/admin task deletion endpoint |
| `POST` | `/api/v1/task-assignments` | Yes | Manager/admin task assignment endpoint |
| `GET` | `/api/v1/dashboards/employee` | Yes | Load employee dashboard summary cards and charts |
| `GET` | `/api/v1/dashboards/manager` | Yes | Load manager dashboard summary cards and charts |
| `GET` | `/api/v1/hours-logged` | Yes | Load scoped hours entries plus weekly/monthly totals |
| `POST` | `/api/v1/hours-logged` | Yes | Create a new hours log entry for the authenticated user |
| `GET` | `/api/v1/productivity-metrics` | Yes | Load role-aware productivity rollups and trend data |
| `GET` | `/api/v1/goals` | Yes | Load visible goals plus quota summary metadata |
| `POST` | `/api/v1/goals` | Yes | Manager/admin goal creation endpoint |
| `PATCH` | `/api/v1/goals/:goalId` | Yes | Manager/admin goal update endpoint |
| `GET` | `/api/v1/notifications` | Yes | Load persistent notifications with unread count |
| `PATCH` | `/api/v1/notifications/:notificationId/read` | Yes | Mark a notification as read |
| `DELETE` | `/api/v1/notifications/:notificationId` | Yes | Dismiss a notification |

## New Integration Notes

- `auth/me` and `users/me` now include `dateOfBirth`, `address`, and `avatarUrl` when available.
- `teams/:teamId/members` now includes `email`, `avatarUrl`, and `isActive` for roster/detail modals.
- Avatar support is URL-based in this phase. The backend stores `avatarUrl`; it does not accept multipart file uploads.
- `POST /api/v1/users` always creates `appRole: "employee"` from the backend side. The frontend should not send or expect arbitrary role creation.
- Manager membership promotion/demotion is intentionally stricter than normal membership edits. Non-admin managers can add and remove regular members, but manager memberships remain admin-controlled.
- `GET /api/v1/notifications` returns `data.notifications` and `data.unreadCount`.
- Due-soon notifications are generated lazily when the notifications list is loaded, then persisted with deduping. Team-added notifications are created immediately when a membership is added.

## Login Flow

1. submit the login form to `POST /api/v1/auth/login`
2. if successful, store `data.session.accessToken`
3. optionally store `data.session.refreshToken` for future refresh support
4. store or cache `data.user`
5. route the user based on `data.user.appRole`
6. call `GET /api/v1/auth/me` on page reload to rebuild the authenticated session state

## Example `fetch()` Requests

### Health

```js
const response = await fetch("http://localhost:4000/api/v1/health");
const result = await response.json();
```

### Login

```js
const response = await fetch("http://localhost:4000/api/v1/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "manager.demo@cloudcomputing.local",
    password: "your-password"
  })
});

const result = await response.json();

if (result.success) {
  localStorage.setItem("accessToken", result.data.session.accessToken);
  localStorage.setItem("refreshToken", result.data.session.refreshToken);
}
```

### Current User

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/auth/me", {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});

const result = await response.json();
```

### Team List

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/teams", {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});

const result = await response.json();
```

### Task List

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch(
  "http://localhost:4000/api/v1/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=false",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

### Create Task

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/tasks", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    teamId: "YOUR_TEAM_ID",
    title: "Prepare weekly client report",
    priority: "high",
    dueAt: "2026-03-28T17:00:00.000Z",
    weekStartDate: "2026-03-23"
  })
});

const result = await response.json();
```

### Assign Task

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/task-assignments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    taskId: "YOUR_TASK_ID",
    assigneeUserId: "EMPLOYEE_USER_ID",
    assignmentNote: "Finish before Friday review."
  })
});

const result = await response.json();
```

### Employee Status Update

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/tasks/YOUR_TASK_ID", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    status: "in_progress",
    progressPercent: 40,
    notes: "Waiting on the final numbers from sales."
  })
});

const result = await response.json();
```

### Employee Dashboard

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/dashboards/employee", {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
});

const result = await response.json();
```

### Manager Dashboard

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch(
  "http://localhost:4000/api/v1/dashboards/manager?teamId=YOUR_TEAM_ID",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

### Hours Logged List

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch(
  "http://localhost:4000/api/v1/hours-logged?dateFrom=2026-03-01&dateTo=2026-03-31",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

### Create Hours Log

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/hours-logged", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    teamId: "YOUR_TEAM_ID",
    taskId: "OPTIONAL_TASK_ID",
    workDate: "2026-03-26",
    hours: 3.5,
    note: "Wrapped up the weekly reporting block."
  })
});

const result = await response.json();
```

### Productivity Metrics

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch(
  "http://localhost:4000/api/v1/productivity-metrics?scope=team&teamId=YOUR_TEAM_ID&referenceDate=2026-03-26",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

### Goals List

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch(
  "http://localhost:4000/api/v1/goals?teamId=YOUR_TEAM_ID&sortBy=endDate&sortOrder=asc",
  {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
);

const result = await response.json();
```

### Create Goal

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/goals", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    teamId: "YOUR_TEAM_ID",
    targetUserId: "EMPLOYEE_USER_ID",
    title: "March sales quota",
    scope: "user",
    goalType: "sales_quota",
    period: "monthly",
    startDate: "2026-03-01",
    endDate: "2026-03-31",
    targetValue: 15000,
    actualValue: 6000,
    unit: "USD"
  })
});

const result = await response.json();
```

### Update Goal

```js
const accessToken = localStorage.getItem("accessToken");

const response = await fetch("http://localhost:4000/api/v1/goals/YOUR_GOAL_ID", {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    actualValue: 15000
  })
});

const result = await response.json();
```

## Error Handling Expectations

- if `success` is `false`, read `error.code` and `error.message`
- show validation feedback when `error.code === "VALIDATION_ERROR"`
- redirect to login when `error.code === "UNAUTHORIZED"`
- show a permissions message when `error.code === "FORBIDDEN"`
- show a missing-scope or not-found state when `error.code === "TEAM_NOT_FOUND"`
- show a task missing state when `error.code === "TASK_NOT_FOUND"`
- show an assignment-target message when `error.code === "ASSIGNEE_NOT_FOUND"` or `error.code === "INVALID_ASSIGNEE_ROLE"`
- show a task/team mismatch message when `error.code === "HOURS_TASK_TEAM_MISMATCH"`
- show an employee-dashboard role message when `error.code === "EMPLOYEE_DASHBOARD_FORBIDDEN"`
- show a productivity-scope role message when `error.code === "PRODUCTIVITY_SCOPE_FORBIDDEN"`
- show a user-missing state when `error.code === "USER_NOT_FOUND"`
- show a goal-not-found state when `error.code === "GOAL_NOT_FOUND"`
- show a goal target-role message when `error.code === "INVALID_GOAL_TARGET_ROLE"`
- show a goal configuration message when `error.code === "INVALID_GOAL_CONFIGURATION"`
- show a setup/configuration message when `error.code` starts with `AUTH_CONFIGURATION`

## Empty and Loading States

- show a loading state while `/auth/me` is in flight after page reload
- show a logged-out state if `/auth/me` returns `401`
- show a setup warning if login succeeds in Supabase but `/auth/me` or login returns `ACCOUNT_NOT_PROVISIONED`
- show an empty employee task state if `/tasks` returns `data.tasks = []`
- show an empty team task state if a manager filter returns no tasks
- show an empty hours state if `/hours-logged` returns `data.hoursLogs = []`
- show an empty productivity state if `/productivity-metrics` returns zero counts across the rollups
- show an empty goals state if `/goals` returns `data.goals = []`
- show an unassigned badge if `task.assignment` is `null`

## Manager vs Employee UI Guidance

- if `appRole` is `manager`, show manager navigation and manager-only pages
- if `appRole` is `employee`, hide manager actions
- use the `teams` array to label the user’s team context once team-based pages arrive
- use `/teams/:teamId/members` to build simple roster cards with name, position, and role badges
- managers should use `/tasks` with `teamId`, `status`, and `assigneeUserId` filters to build workload views
- employees should call `/tasks` without an `assigneeUserId`; the backend automatically scopes tasks to the logged-in employee
- managers can use `/hours-logged?teamId=...` to build team time-report summaries
- employees should call `/productivity-metrics` without a `userId`; the backend automatically scopes metrics to the logged-in employee
- managers can use `/productivity-metrics?scope=team&teamId=...` for team rollups and `/productivity-metrics?scope=individual&userId=...` for employee detail panels
- employees can call `/goals` directly; the backend will return their team goals plus user-scoped goals assigned to them
- managers can use `/goals?teamId=...` for team quota views and `/goals?teamId=...&userId=...&scope=user` for employee quota detail

## Sorting and Rendering Guidance

- use `sortBy=urgency&sortOrder=asc` for the default employee and manager task lists
- use `task.isOverdue` to render overdue badges first
- use `task.isDueSoon` for warning highlights before a task becomes overdue
- use `task.timeRemainingSeconds` to render countdown text when `dueAt` exists
- use priority badges consistently: `low`, `medium`, `high`, `urgent`
- render assignment state from `task.assignment`; if it is `null`, show the task as unassigned
- use `meta.total`, `meta.page`, and `meta.limit` from `/tasks` for pagination controls
- render goal progress from `goal.progressPercent`, `goal.remainingValue`, and `goal.isTargetMet`

## Dashboard Rendering Guidance

- use `data.summary` for top-line dashboard cards
- use `data.charts.byStatus` and `data.charts.byPriority` directly for bar or donut charts
- use `data.charts.workloadByEmployee` from the manager dashboard for workload comparison charts
- use `data.tasks.upcomingDeadlines` for deadline widgets
- use `data.tasks.urgentTasks` for urgent attention lists
- when a dashboard array is empty, render a zero-state instead of hiding the section entirely

## Goals Rendering Guidance

- use `data.summary.totalTargetValue` and `data.summary.totalActualValue` for top-line quota cards only when `data.summary.hasMixedUnits === false`
- when `data.summary.hasMixedUnits === true`, render grouped cards from `data.summary.totalsByUnit` instead of one combined total
- use `data.summary.primaryUnit` to label single-unit goal summaries
- use each goal's `progressPercent` and `isTargetMet` to render progress bars and completion badges
- use `data.charts.byStatus`, `data.charts.byPeriod`, and `data.charts.byScope` for simple bar or donut charts
- team-scoped goals have `targetUser = null`; render them as shared team goals
- user-scoped goals include `targetUser.fullName` and can be grouped under employee detail panels

## Stable vs In-Progress Backend Modules

### Stable

- health
- auth login
- auth current user
- RBAC middleware foundation
- normalized MVP schema
- users and teams endpoints
- task CRUD and assignment endpoints
- employee and manager dashboard endpoints
- hours logging create/list endpoints
- productivity metrics endpoint
- goals endpoints

### Optional Next Enhancements

- task comments and activity history
- notifications and reminders
- export-ready reporting
