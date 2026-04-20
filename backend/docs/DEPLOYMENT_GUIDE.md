# Deployment Guide

## Recommended Deployment Target

Use the dedicated **OCI compute instance** for the TaskTrail backend.

The production deployment path is:

- GitHub Actions on pushes to `main`
- Docker image build for `backend/`
- push image to GHCR
- SSH deploy to the dedicated TaskTrail OCI VM
- Caddy reverse proxy on the VM serves `https://api.tasktrail.site`

The database remains hosted in Supabase, and SMTP remains managed through Supabase Auth + Resend.

## Current Production Shape

TaskTrail’s backend is packaged as a single production container:

- Dockerfile: [backend/Dockerfile](/Users/admin/Documents/GitHub/cloud-computing-project/backend/Dockerfile)
- Docker ignore rules: [backend/.dockerignore](/Users/admin/Documents/GitHub/cloud-computing-project/backend/.dockerignore)

Runtime model:

- Dockerized backend
- env injected from `/etc/tasktrail-backend.env` on the OCI VM
- backend container listens on `127.0.0.1:4000`
- Caddy reverse proxies `api.tasktrail.site -> 127.0.0.1:4000`

Notes:

- The container uses `npm start`, which runs `node src/server.js`.
- The image installs production dependencies only.
- Secrets must be injected at runtime; do not bake `.env` into the image.
- `NODE_ENV=production` requires real HTTPS frontend origins and a real `SUPABASE_AUTH_EMAIL_REDIRECT_TO`, so localhost-only values are intentionally rejected in that mode.
- `PORT` defaults to `4000` and the image exposes `4000`.

## Automated Deployment Flow

This repo now uses a backend-only deployment workflow:

- workflow file: `.github/workflows/backend-deploy.yml`
- remote deploy script: [backend/scripts/deploy-oci-backend.sh](/Users/admin/Documents/GitHub/cloud-computing-project/backend/scripts/deploy-oci-backend.sh)
- health check path: `/api/v1/health`
- smoke check script: [backend/scripts/smoke-test.js](/Users/admin/Documents/GitHub/cloud-computing-project/backend/scripts/smoke-test.js)

The workflow runs on pushes to `main` when backend deployment files change:

- `backend/**`
- `.github/workflows/backend-deploy.yml`
- `backend/scripts/deploy-oci-backend.sh`

The workflow jobs are:

1. run backend tests with Node 22
2. build the Docker image from `backend/`
3. push the image to GHCR as:
   - `ghcr.io/blank-space-gsu/tasktrail-backend:sha-<commit-sha>`
   - `ghcr.io/blank-space-gsu/tasktrail-backend:latest`
4. SSH to the dedicated TaskTrail OCI VM
5. pull and restart the backend container
6. verify local health on the VM
7. verify public health at `https://api.tasktrail.site/api/v1/health`

## GitHub Secrets Required

Set these repository secrets before enabling the workflow:

| Secret | Purpose |
| --- | --- |
| `OCI_VM_HOST` | Public IP or hostname of the dedicated TaskTrail OCI VM |
| `OCI_VM_USER` | SSH user for that VM, typically `ubuntu` |
| `OCI_SSH_PRIVATE_KEY` | Private key for SSH access to the dedicated TaskTrail OCI VM |
| `GHCR_READ_TOKEN` | GitHub token with package read access for `ghcr.io/blank-space-gsu/tasktrail-backend` |

Notes:

- The workflow uses the built-in `GITHUB_TOKEN` to push to GHCR.
- `GHCR_READ_TOKEN` is only for the remote VM to pull images from GHCR.

## OCI VM Prerequisites

Before enabling auto-deploy:

1. Docker must already be installed and running on the dedicated TaskTrail OCI VM
2. `/etc/tasktrail-backend.env` must already exist on that VM with the correct production values
3. the backend must already be healthy on that host
4. Caddy must already be reverse proxying:
   - `api.tasktrail.site -> 127.0.0.1:4000`

The deployment script is intentionally designed for the **dedicated TaskTrail VM only** and should not be repointed at older shared hosts.

## Required Runtime Environment Variables

These belong in `/etc/tasktrail-backend.env` on the OCI VM:

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
2. apply any required migrations manually before merging code that depends on them
3. push the backend change to `main`
4. let GitHub Actions build, publish, and deploy the backend automatically
5. verify `https://api.tasktrail.site/api/v1/health`
6. run the smoke check against the deployed API base URL

## Post-Deploy Smoke Check

From `/Users/admin/Documents/GitHub/cloud-computing-project/backend`:

```bash
SMOKE_TEST_BASE_URL=https://api.tasktrail.site \
SMOKE_TEST_EMAIL=olivia.hart@tasktrail.local \
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

- keep real secrets only in GitHub repository secrets and the OCI VM env file, not in the repo
- if the frontend is deployed separately, remember to update `FRONTEND_APP_ORIGIN` in `/etc/tasktrail-backend.env`
- keep Supabase Auth email confirmations enabled when self-service signup is live
- if you need verification emails to reach arbitrary inboxes, configure a production SMTP provider in Supabase Auth
- TaskTrail production should use Resend-backed custom SMTP instead of the default Supabase provider
- if deployment fails but health passes locally, compare GitHub secrets and `/etc/tasktrail-backend.env` first
- if auth fails in production, verify `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET`
- if verification links redirect to the wrong place, verify both Supabase URL Configuration and `SUPABASE_AUTH_EMAIL_REDIRECT_TO`
- if verification emails stop arriving, check both the Resend verified-domain state and Supabase Auth SMTP settings before changing application code
- if database connectivity fails, verify the Supabase pooler `DATABASE_URL`
- GitHub Actions does **not** run `supabase db push`; schema changes remain manual and deliberate
- if backend code depends on new schema, apply migrations before merging to `main`

## Rollback Approach

If a deploy introduces a regression:

1. let the deploy script attempt an automatic container rollback to the previous image
2. confirm `https://api.tasktrail.site/api/v1/health` is green again
3. rerun the smoke check
4. fix forward in Git after identifying the issue
5. if the automatic rollback also fails, repair the VM manually using the previously running image

## Source Links

- GitHub Actions: [https://docs.github.com/actions](https://docs.github.com/actions)
- GitHub Container Registry: [https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
