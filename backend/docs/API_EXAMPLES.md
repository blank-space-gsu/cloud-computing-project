# API Examples

## Login Example

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager.demo@cloudcomputing.local",
    "password": "your-password"
  }'
```

## Current User Example

```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## User Profile Example

```bash
curl http://localhost:4000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Team List Example

```bash
curl http://localhost:4000/api/v1/teams \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Team Members Example

```bash
curl http://localhost:4000/api/v1/teams/YOUR_TEAM_ID/members \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Task List Example

```bash
curl "http://localhost:4000/api/v1/tasks?sortBy=urgency&sortOrder=asc&includeCompleted=false" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Create Task Example

```bash
curl -X POST http://localhost:4000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "teamId": "YOUR_TEAM_ID",
    "title": "Prepare weekly client report",
    "priority": "high",
    "dueAt": "2026-03-28T17:00:00.000Z",
    "weekStartDate": "2026-03-23"
  }'
```

## Update Task Example

```bash
curl -X PATCH http://localhost:4000/api/v1/tasks/YOUR_TASK_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "status": "in_progress",
    "progressPercent": 40,
    "notes": "Waiting on sales numbers."
  }'
```

## Assign Task Example

```bash
curl -X POST http://localhost:4000/api/v1/task-assignments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "taskId": "YOUR_TASK_ID",
    "assigneeUserId": "EMPLOYEE_USER_ID",
    "assignmentNote": "Finish before Friday review."
  }'
```

## Employee Dashboard Example

```bash
curl http://localhost:4000/api/v1/dashboards/employee \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Manager Dashboard Example

```bash
curl "http://localhost:4000/api/v1/dashboards/manager?teamId=YOUR_TEAM_ID" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Hours Logged List Example

```bash
curl "http://localhost:4000/api/v1/hours-logged?dateFrom=2026-03-01&dateTo=2026-03-31" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Create Hours Log Example

```bash
curl -X POST http://localhost:4000/api/v1/hours-logged \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "teamId": "YOUR_TEAM_ID",
    "taskId": "OPTIONAL_TASK_ID",
    "workDate": "2026-03-26",
    "hours": 3.5,
    "note": "Wrapped up the weekly reporting block."
  }'
```

## Team Productivity Metrics Example

```bash
curl "http://localhost:4000/api/v1/productivity-metrics?scope=team&teamId=YOUR_TEAM_ID&referenceDate=2026-03-26" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Individual Productivity Metrics Example

```bash
curl "http://localhost:4000/api/v1/productivity-metrics?scope=individual&userId=EMPLOYEE_USER_ID&teamId=YOUR_TEAM_ID&referenceDate=2026-03-26" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Goals List Example

```bash
curl "http://localhost:4000/api/v1/goals?teamId=YOUR_TEAM_ID&sortBy=endDate&sortOrder=asc" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Create Goal Example

```bash
curl -X POST http://localhost:4000/api/v1/goals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "teamId": "YOUR_TEAM_ID",
    "targetUserId": "EMPLOYEE_USER_ID",
    "title": "March sales quota",
    "scope": "user",
    "goalType": "sales_quota",
    "period": "monthly",
    "startDate": "2026-03-01",
    "endDate": "2026-03-31",
    "targetValue": 15000,
    "actualValue": 6000,
    "unit": "USD"
  }'
```

## Update Goal Example

```bash
curl -X PATCH http://localhost:4000/api/v1/goals/YOUR_GOAL_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "actualValue": 15000
  }'
```

## Manager Access Check Example

```bash
curl http://localhost:4000/api/v1/auth/manager-access \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Health Example

```bash
curl http://localhost:4000/api/v1/health
```
