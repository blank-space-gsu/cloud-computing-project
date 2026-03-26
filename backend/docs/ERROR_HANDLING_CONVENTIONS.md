# Error Handling Conventions

## Standard Error Envelope

All backend errors use the same top-level shape:

```json
{
  "success": false,
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message",
    "details": []
  },
  "meta": {
    "timestamp": "2026-03-26T04:00:00.000Z",
    "path": "/api/v1/example",
    "method": "GET"
  }
}
```

## Current Error Categories

### Validation Errors

- HTTP status: `400`
- codes: `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_INPUT`, `CONSTRAINT_VIOLATION`
- used when request input fails validation, JSON parsing, or basic database-backed input constraints

### Authentication Errors

- HTTP status: `401`
- codes: `UNAUTHORIZED`, `INVALID_CREDENTIALS`
- used for missing bearer tokens, bad tokens, or bad login credentials

### Authorization Errors

- HTTP status: `403`
- codes: `FORBIDDEN`, `ACCOUNT_NOT_PROVISIONED`, `ACCOUNT_DISABLED`, `TASK_CREATION_FORBIDDEN`, `TASK_DELETION_FORBIDDEN`, `TASK_UPDATE_FORBIDDEN`, `TASK_ASSIGNMENT_FORBIDDEN`, `TEAM_MANAGEMENT_FORBIDDEN`, `EMPLOYEE_DASHBOARD_FORBIDDEN`, `PRODUCTIVITY_SCOPE_FORBIDDEN`
- used when a user is authenticated but not allowed to access a resource

### Resource Scope Errors

- HTTP status: `404`
- codes: `TEAM_NOT_FOUND`, `TASK_NOT_FOUND`, `ASSIGNEE_NOT_FOUND`, `USER_NOT_FOUND`
- used when a resource does not exist or is outside the user scope

### Conflict Errors

- HTTP status: `409`
- codes: `CONFLICT`, `REFERENCE_CONSTRAINT_VIOLATION`
- used when a request collides with an existing record or violates referential integrity

### Business Rule Errors

- HTTP status: `400`
- code: `INVALID_ASSIGNEE_ROLE`, `HOURS_TASK_TEAM_MISMATCH`
- used when a request is structurally valid but breaks a task-domain rule

### Missing Routes

- HTTP status: `404`
- code: `NOT_FOUND`
- used when no route matches the request

### Configuration Errors

- HTTP status: `503`
- codes: `AUTH_CONFIGURATION_MISSING`, `AUTH_ADMIN_CONFIGURATION_MISSING`
- used when required Supabase configuration is missing

### Unexpected Server Errors

- HTTP status: `500`
- code: `INTERNAL_SERVER_ERROR`
- used for uncaught failures

## Frontend Handling Guidance

- use `error.code` for UI branching when needed
- show `error.message` as the primary human-readable message
- treat `details` as optional field-level validation data
- use `401` responses to trigger logout or redirect-to-login behavior
- use `403` responses to show permission or provisioning errors

## Current Stable Error Codes

- `VALIDATION_ERROR`
- `INVALID_JSON`
- `INVALID_INPUT`
- `UNAUTHORIZED`
- `INVALID_CREDENTIALS`
- `FORBIDDEN`
- `ACCOUNT_NOT_PROVISIONED`
- `ACCOUNT_DISABLED`
- `TEAM_NOT_FOUND`
- `TASK_NOT_FOUND`
- `ASSIGNEE_NOT_FOUND`
- `USER_NOT_FOUND`
- `TASK_CREATION_FORBIDDEN`
- `TASK_DELETION_FORBIDDEN`
- `TASK_UPDATE_FORBIDDEN`
- `TASK_ASSIGNMENT_FORBIDDEN`
- `TEAM_MANAGEMENT_FORBIDDEN`
- `EMPLOYEE_DASHBOARD_FORBIDDEN`
- `PRODUCTIVITY_SCOPE_FORBIDDEN`
- `INVALID_ASSIGNEE_ROLE`
- `HOURS_TASK_TEAM_MISMATCH`
- `CONSTRAINT_VIOLATION`
- `CONFLICT`
- `REFERENCE_CONSTRAINT_VIOLATION`
- `NOT_FOUND`
- `AUTH_CONFIGURATION_MISSING`
- `AUTH_ADMIN_CONFIGURATION_MISSING`
- `INTERNAL_SERVER_ERROR`
