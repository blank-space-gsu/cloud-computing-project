# Auth and RBAC

## Current Auth Approach

Phase 2 uses Supabase Auth as the identity provider, but the frontend talks to backend REST endpoints instead of calling Supabase directly.

### Why this approach fits the project

- the frontend team only has to learn one API surface
- backend responses stay consistent with the rest of the system
- role and team-based checks can happen in one place
- future protected endpoints can reuse the same middleware

## Implemented Endpoints

### `POST /api/v1/auth/signup`

- creates a real Supabase Auth account through the backend
- requires the caller to choose exactly one global app role: `manager` or `employee`
- sends the Supabase verification email instead of logging the user in immediately
- applies the selected app role through trusted server-side admin metadata update
- syncs the matching `public.users` profile
- returns a pending-verification payload, not an authenticated session
- fails with `409 ACCOUNT_ALREADY_EXISTS` for duplicate email signup

### `POST /api/v1/auth/login`

- authenticates a user with email and password using Supabase Auth
- returns the access token, refresh token, and the application profile
- fails with `401 INVALID_CREDENTIALS` for bad credentials
- fails with `403 EMAIL_NOT_VERIFIED` if the account exists but the email is still unconfirmed
- fails with `403 ACCOUNT_NOT_PROVISIONED` if the auth account has no `public.users` profile

### `GET /api/v1/auth/me`

- requires `Authorization: Bearer <access-token>`
- verifies the Supabase access token server-side
- loads the matching application profile from `public.users`
- returns the authenticated user plus team memberships
- self-heals missing or stale app-profile rows from auth metadata when possible before failing

### `GET /api/v1/auth/manager-access`

- protected RBAC smoke-check endpoint for manager-only access
- useful for verification and automated tests during the MVP build
- requires role `manager` or `admin`

## Role Rules

### `employee`

- can authenticate
- can load their own authenticated profile
- can sign up only as a globally `employee` user in this phase
- can load only tasks actively assigned to themselves
- can update only their own task `status`, `progressPercent`, and `notes`
- cannot use manager-only endpoints
- cannot create, delete, or assign tasks
- can self-join teams only through employee/member join access

### `manager`

- can authenticate
- can sign up only as a globally `manager` user in this phase
- can load their own authenticated profile
- can pass manager-only RBAC checks
- can create, update, delete, and assign tasks for teams they manage
- can view team task lists and employee assignments for manageable teams
- can access the manager dashboard summary for manageable teams
- can load and regenerate employee/member and manager join access for teams they manage
- can self-join teams as a manager only through manager-granting join access

### `admin`

- reserved for later operational controls
- already treated as a privileged role by the RBAC middleware
- can access all current task endpoints regardless of team membership
- can access the manager dashboard endpoint across visible teams

## Auth Middleware Flow

1. read the `Authorization` header
2. require the `Bearer` scheme
3. verify the token with Supabase via `auth.getUser(jwt)`
4. load the matching application profile from `public.users`
5. reject disabled or missing profiles
6. attach the resolved context to `request.auth`

## Profile Provisioning

Phase 2 adds an auth profile sync trigger:

- when a user is created in `auth.users`, a matching row is inserted into `public.users`
- when a user email or auth metadata changes later, the matching `public.users` row is updated too
- first name, last name, and job title are seeded from user metadata
- the trusted global app role is applied through backend-controlled auth metadata updates

This keeps auth identity and application profile data aligned.

## Team Join Access Role Rules

- `team_access_tokens.granted_membership_role` is the source of truth for what a token can create
- employee/member join access can only activate `member` memberships
- manager join access can only activate `manager` memberships
- globally `employee` users cannot consume manager-granting access
- globally `manager` users cannot consume employee/member join access
- prior `left` memberships can reactivate through matching join access
- prior `removed` memberships cannot self-reactivate in this slice

## Demo Accounts

This phase includes a demo seeding script:

- script: `npm run seed:demo-users`
- creates one manager and two employees
- syncs their profile rows and team membership
- uses `DEMO_USER_PASSWORD` from the local `.env`

Demo emails:

- `manager.demo@cloudcomputing.local`
- `employee.one@cloudcomputing.local`
- `employee.two@cloudcomputing.local`

## Current Verification Snapshot

Auth and RBAC are currently considered healthy because:

- login works with a seeded demo user
- `/auth/me` returns the expected user profile
- missing or invalid tokens return `401`
- employee access to manager-only routes returns `403`
- auth and RBAC tests pass
- employee attempts to assign tasks are blocked
- employee task updates are restricted at the service layer
