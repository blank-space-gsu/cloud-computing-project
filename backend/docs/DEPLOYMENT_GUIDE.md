# Deployment Guide

## Recommended Deployment Target

Use Render for this backend.

Why this is the best fit for the project:

- easy Node.js web-service setup
- simple environment-variable management
- straightforward deploy logs and health checks
- friendly for student teams that want one backend service without extra infrastructure

The database still stays in Supabase, because the project requirement is Supabase PostgreSQL.

## Deployment Artifacts in This Repo

- root Blueprint file: `/Users/admin/Documents/GitHub/cloud-computing-project/render.yaml`
- runtime target: Node 22
- health check path: `/api/v1/health`
- local smoke check script: `/Users/admin/Documents/GitHub/cloud-computing-project/backend/scripts/smoke-test.js`

## Prerequisites

Before deploying:

1. the backend should already pass `npm test`
2. the linked Supabase project should already contain the applied migrations
3. you should have the production values for:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `DATABASE_URL`
   - `FRONTEND_APP_ORIGIN` (`https://tasktrail.site` and any exact additional deployed origins)
   - `SUPABASE_AUTH_EMAIL_REDIRECT_TO` (`https://tasktrail.site`)
4. you should also have the production email-delivery inputs ready for Supabase Auth:
   - a verified Resend domain for TaskTrail
   - a Resend API key to use as the SMTP password
   - the final sender identity (`TaskTrail Auth <auth@tasktrail.site>`)

## Option A - Deploy with the Included `render.yaml`

This is the easiest and most repeatable option.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint deployment from the repository.
3. Render will detect `/render.yaml`.
4. Confirm the web service name and branch.
5. Enter the secret environment variables when Render prompts for them.
6. Finish the deploy.

The Blueprint is configured so Render deploys the backend from `backend/` while keeping the repo in monorepo form.

## Option B - Manual Render Setup

If you prefer the dashboard flow instead of Blueprints:

1. Create a new Web Service in Render from the repository.
2. Set the root directory to `backend`.
3. Set the runtime to Node.
4. Set the build command to `npm install`.
5. Set the start command to `npm start`.
6. Set the health check path to `/api/v1/health`.
7. Set the Node version to `22`.
8. Add the required environment variables listed below.

## Required Environment Variables

These should be set in Render:

| Variable | Value source | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Required for production mode |
| `API_PREFIX` | `/api/v1` | Keep consistent with docs and frontend |
| `FRONTEND_APP_ORIGIN` | `https://tasktrail.site` | Comma-separate multiple exact allowed origins if needed |
| `SUPABASE_AUTH_EMAIL_REDIRECT_TO` | `https://tasktrail.site` | Where Supabase should redirect users after they confirm signup |
| `SUPABASE_PROJECT_REF` | Supabase project ref | Helpful for operational clarity |
| `SUPABASE_URL` | Supabase project settings | Required for auth |
| `SUPABASE_ANON_KEY` | Supabase project settings | Required for backend-managed login |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Server-side privileged operations only |
| `SUPABASE_JWT_SECRET` | Supabase JWT settings | Required for token verification |
| `DATABASE_URL` | Supabase connection string | Use the pooler connection string |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Practical with the Supabase pooler connection used here |
| `DEMO_USER_PASSWORD` | optional | Useful only if you want demo-user seeding or smoke login checks |

## Production Auth Email Setup

TaskTrail’s backend already performs the correct signup + verification flow. What blocked production delivery was operational mail configuration: Supabase’s default email service is intentionally limited and should be replaced with custom SMTP for real signup verification traffic.

### Repo / runtime settings

Set these in the deployed backend environment:

- `FRONTEND_APP_ORIGIN=https://tasktrail.site`
- `SUPABASE_AUTH_EMAIL_REDIRECT_TO=https://tasktrail.site`

The backend now fails fast in production if either value still points at localhost, is non-HTTPS, or if the redirect URL does not share an origin with the configured frontend origin list.

### Resend dashboard steps

1. Add a sending domain in Resend.
2. Use a TaskTrail-owned domain. Resend recommends using a subdomain to isolate sender reputation and make the sending purpose clearer.
3. To match the requested TaskTrail convention:
   - visible sender: `auth@tasktrail.site`
   - mail infrastructure / return-path: `auth.tasktrail.site`
   Verify `tasktrail.site` in Resend, then set the custom return path to `auth`. Resend documents that custom return paths control the SPF / Return-Path subdomain and default to `send.<domain>`.
4. Add the DNS records Resend shows for that domain. Resend requires SPF and DKIM records for sending, and recommends adding DMARC for stronger trust with inbox providers.
5. Wait for the domain status to become `verified`.
6. Create the API key you will use as the SMTP password. Resend SMTP uses:
   - host: `smtp.resend.com`
   - username: `resend`
   - password: your Resend API key
   - port: `465` for implicit TLS or `587` for STARTTLS.
7. If you want to inspect domain status through the CLI, use a full-access Resend API key. In this environment the installed CLI is authenticated, but only with a sending-access key, which cannot list domains.

### Supabase dashboard steps

1. Open **Authentication -> URL Configuration**.
2. Set **Site URL** to `https://tasktrail.site`. This is the default redirect URL used for email confirmations and password resets.
3. Add exact **Redirect URLs** for every deployed verification return URL you intend to allow, starting with `https://tasktrail.site`. Prefer exact production URLs rather than loose wildcard patterns.
4. Keep **Confirm email** enabled. With confirm email enabled, `signUp()` returns a user and `session: null`; if it is disabled, signup returns an immediate session instead.
5. Open **Authentication -> SMTP Settings** (or the equivalent Auth config screen) and enable custom SMTP. Supabase’s custom SMTP settings expect:
   - `smtp_admin_email`: `auth@tasktrail.site`
   - `smtp_host`: `smtp.resend.com`
   - `smtp_port`: `465` or `587`
   - `smtp_user`: `resend`
   - `smtp_pass`: your Resend API key
   - sender name: `TaskTrail Auth`.
6. After custom SMTP is saved, review **Authentication -> Rate Limits** and raise the email send limit to a sane production value.
7. If you customize Supabase email templates later, keep the confirmation links aligned with `Site URL` / `RedirectTo`, and avoid provider-side link rewriting or tracking that can break confirmation URLs.

## Deployment Sequence

Recommended order:

1. confirm migrations are aligned with `supabase migration list`
2. deploy the backend service to Render
3. wait for Render to report the health check as passing
4. run the smoke check against the deployed base URL
5. update the frontend team with the stable deployed API base URL

## Post-Deploy Smoke Check

From `/Users/admin/Documents/GitHub/cloud-computing-project/backend`:

```bash
SMOKE_TEST_BASE_URL=https://your-api.onrender.com \
SMOKE_TEST_EMAIL=manager.demo@cloudcomputing.local \
SMOKE_TEST_PASSWORD=your-demo-password \
SMOKE_TEST_EXPECT_MANAGER_ACCESS=true \
npm run smoke
```

Minimum success criteria:

- health check passes
- login passes
- `/auth/me` passes
- manager RBAC smoke check returns the expected result

## Demo Readiness Checklist

Before a presentation:

1. verify the deployed health endpoint is green
2. log in as the manager demo user
3. create and assign a task
4. log in as the employee demo user
5. update task progress
6. verify the dashboard summaries refresh correctly
7. verify hours and goal views load without errors

## Operational Notes

- keep real secrets only in Render environment-variable settings, not in the repo
- if the frontend is deployed separately, remember to update `FRONTEND_APP_ORIGIN`
- keep Supabase Auth email confirmations enabled when self-service signup is live
- if you need verification emails to reach arbitrary inboxes, configure a production SMTP provider in Supabase Auth
- TaskTrail production should use Resend-backed custom SMTP instead of the default Supabase provider
- if deployment fails but health passes locally, compare Render environment variables first
- if auth fails in production, verify `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET`
- if verification links redirect to the wrong place, verify both Supabase URL Configuration and `SUPABASE_AUTH_EMAIL_REDIRECT_TO`
- if verification emails stop arriving, check both the Resend verified-domain state and Supabase Auth SMTP settings before changing application code
- if database connectivity fails, verify the Supabase pooler `DATABASE_URL`

## Rollback Approach

If a deploy introduces a regression:

1. roll back to the previous working Render deploy
2. confirm `/api/v1/health` is green again
3. rerun the smoke check
4. fix forward in Git after identifying the issue

## Source Links

- Render Blueprint reference: [https://render.com/docs/blueprint-spec](https://render.com/docs/blueprint-spec)
- Render monorepo support: [https://render.com/docs/monorepo-support](https://render.com/docs/monorepo-support)
