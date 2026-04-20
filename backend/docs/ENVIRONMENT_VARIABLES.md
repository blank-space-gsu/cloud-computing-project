# Environment Variables

## Purpose

This project keeps runtime configuration in environment variables so secrets do not live in tracked source files and each environment can be configured independently.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill in the real Supabase keys and database password.
3. Keep `.env` untracked.
4. Restart the backend after changing environment variables.

## Variables

| Variable | Required now | Example | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | `development` | Selects runtime mode and logging behavior |
| `PORT` | Yes | `4000` | Port used by the Express server |
| `APP_NAME` | Yes | `workforce-task-management-backend` | Display name for health and logging output |
| `API_PREFIX` | Yes | `/api/v1` | Base prefix for all REST endpoints |
| `FRONTEND_APP_ORIGIN` | Yes | `http://localhost:5500` | Allowed frontend origin for CORS. Multiple values can be comma-separated. In production, use exact HTTPS TaskTrail origins such as `https://tasktrail.site,https://www.tasktrail.site`. |
| `SUPABASE_AUTH_EMAIL_REDIRECT_TO` | Required in production | `http://localhost:5500` | Redirect target used in Supabase verification emails. In production this must be set explicitly, must use HTTPS, and must share an origin with `FRONTEND_APP_ORIGIN`. |
| `SUPABASE_PROJECT_REF` | Recommended | `dfllpxijgfcoazwstegl` | Helps document which hosted Supabase project this backend targets |
| `SUPABASE_URL` | Recommended in Phase 1, required in Phase 2 | `https://dfllpxijgfcoazwstegl.supabase.co` | Base URL for Supabase Auth and future backend integrations |
| `SUPABASE_ANON_KEY` | Not used in Phase 1, required in Phase 2 | `...` | Used for auth flows such as password sign-in via backend-managed endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used in Phase 1, required in later protected server operations | `...` | Used only by trusted backend code for elevated Supabase access |
| `SUPABASE_JWT_SECRET` | Not used in Phase 1, required in Phase 2 token verification flows | `...` | Used to verify Supabase-issued JWTs when backend validation is implemented |
| `DATABASE_URL` | Required for database-backed runtime features | `postgresql://...?...sslmode=no-verify` | Connection string used by the `pg` pool |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Recommended | `false` | Controls the TLS certificate check used by the `pg` client |
| `DEMO_USER_PASSWORD` | Optional | `your-demo-user-password` | Used by the demo seed flow and convenient local smoke checks |
| `SMOKE_TEST_BASE_URL` | Optional | `http://localhost:4000` | Base URL used by `npm run smoke` |
| `SMOKE_TEST_EMAIL` | Optional | `olivia.hart@tasktrail.local` | Login identity for smoke verification |
| `SMOKE_TEST_PASSWORD` | Optional | `your-demo-user-password` | Password used by the smoke login flow |
| `SMOKE_TEST_EXPECT_MANAGER_ACCESS` | Optional | `true` | Whether the smoke check should expect manager-only RBAC access to pass |

## Phase 1 Notes

- The backend can boot without `DATABASE_URL`, but health output will report `data.database.status = "not_configured"`.
- Database-backed features should not be built until `DATABASE_URL` is set.
- Phase 2 will rely on the Supabase auth variables listed above.
- Hosted Supabase projects should also have email confirmations enabled in Auth settings when self-service signup is active.
- For the Supabase pooler setup used in this project, `sslmode=no-verify` is the practical local-development setting.
- Phase 9 adds optional smoke-test variables for deployment verification; they are not required for the API to boot.

## Production Auth Email Notes

- The backend does **not** send SMTP mail directly. Supabase Auth sends verification emails, so SMTP credentials belong in the Supabase dashboard or Management API settings, not in this backend `.env`.
- For TaskTrail production, set:
  - `FRONTEND_APP_ORIGIN=https://tasktrail.site` (plus any exact additional deployed origins)
  - `SUPABASE_AUTH_EMAIL_REDIRECT_TO=https://tasktrail.site`
- The backend now fails fast in production if:
  - `SUPABASE_AUTH_EMAIL_REDIRECT_TO` is omitted
  - `FRONTEND_APP_ORIGIN` or `SUPABASE_AUTH_EMAIL_REDIRECT_TO` still point at localhost / loopback hosts
  - either value is non-HTTPS
  - the redirect URL does not share an origin with the configured frontend origin list
- TaskTrail’s production SMTP delivery should use Supabase custom SMTP with Resend:
  - SMTP host: `smtp.resend.com`
  - SMTP user: `resend`
  - SMTP password: a Resend API key
  - sender identity: `TaskTrail Auth <auth@tasktrail.site>`
- The mail infrastructure can still be isolated onto `auth.tasktrail.site` through Resend’s custom return-path setting while keeping the visible sender as `auth@tasktrail.site`.

## Security Guidance

- Never commit `.env`.
- Treat `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and the database password as sensitive secrets.
- Treat `SMOKE_TEST_PASSWORD` the same way you would treat any demo credential.
- The anon key is less sensitive than the service role key, but it should still be managed through environment configuration rather than being hardcoded.
