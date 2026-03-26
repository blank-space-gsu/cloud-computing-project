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
   - `FRONTEND_APP_ORIGIN`

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
| `FRONTEND_APP_ORIGIN` | your deployed frontend origin | Comma-separate multiple allowed origins if needed |
| `SUPABASE_PROJECT_REF` | Supabase project ref | Helpful for operational clarity |
| `SUPABASE_URL` | Supabase project settings | Required for auth |
| `SUPABASE_ANON_KEY` | Supabase project settings | Required for backend-managed login |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Server-side privileged operations only |
| `SUPABASE_JWT_SECRET` | Supabase JWT settings | Required for token verification |
| `DATABASE_URL` | Supabase connection string | Use the pooler connection string |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Practical with the Supabase pooler connection used here |
| `DEMO_USER_PASSWORD` | optional | Useful only if you want demo-user seeding or smoke login checks |

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
- if deployment fails but health passes locally, compare Render environment variables first
- if auth fails in production, verify `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_JWT_SECRET`
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
