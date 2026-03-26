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
| `FRONTEND_APP_ORIGIN` | Yes | `http://localhost:5500` | Allowed frontend origin for CORS. Multiple values can be comma-separated. |
| `SUPABASE_PROJECT_REF` | Recommended | `dfllpxijgfcoazwstegl` | Helps document which hosted Supabase project this backend targets |
| `SUPABASE_URL` | Recommended in Phase 1, required in Phase 2 | `https://dfllpxijgfcoazwstegl.supabase.co` | Base URL for Supabase Auth and future backend integrations |
| `SUPABASE_ANON_KEY` | Not used in Phase 1, required in Phase 2 | `...` | Used for auth flows such as password sign-in via backend-managed endpoints |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used in Phase 1, required in later protected server operations | `...` | Used only by trusted backend code for elevated Supabase access |
| `SUPABASE_JWT_SECRET` | Not used in Phase 1, required in Phase 2 token verification flows | `...` | Used to verify Supabase-issued JWTs when backend validation is implemented |
| `DATABASE_URL` | Required for database-backed runtime features | `postgresql://...?...sslmode=no-verify` | Connection string used by the `pg` pool |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Recommended | `false` | Controls the TLS certificate check used by the `pg` client |

## Phase 1 Notes

- The backend can boot without `DATABASE_URL`, but health output will report `data.database.status = "not_configured"`.
- Database-backed features should not be built until `DATABASE_URL` is set.
- Phase 2 will rely on the Supabase auth variables listed above.
- For the Supabase pooler setup used in this project, `sslmode=no-verify` is the practical local-development setting.

## Security Guidance

- Never commit `.env`.
- Treat `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and the database password as sensitive secrets.
- The anon key is less sensitive than the service role key, but it should still be managed through environment configuration rather than being hardcoded.
