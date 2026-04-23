# TaskTrail Web

Static, single-page web client for TaskTrail. No framework, no build step — just HTML, CSS, and JavaScript with a hash router talking to the backend at `/api/v1`.

Live at **[tasktrail.site](https://tasktrail.site)** (deployed on Vercel).

This repo only contains the web client. The Flutter mobile client lives in the separate **[tasktrail-mobile](https://github.com/blank-space-gsu/tasktrail-mobile)** repository and talks to the same backend.

## What's here

- Public landing page before sign-in
- Role-aware login that routes managers and employees to different shells
- Shared app shell: sidebar, header, modals, toasts, loading and empty states
- **Manager** surfaces: Dashboard, Worker Tracker, Tasks, Teams, Profile
- **Employee** surfaces: My Tasks, Calendar, Teams, Join Team, Profile
- Backend-backed self-profile editing
- Manager join-access controls (short codes and invite links)
- Employee join, leave, and rejoin flow
- Responsive layout for desktop, tablet, and phone widths

## Structure

```text
frontend/
├── index.html
├── favicon.svg
├── css/
│   └── styles.css
└── js/
    ├── api.js          # fetch wrapper and endpoint helpers
    ├── auth.js         # session + role guards
    ├── router.js       # hash-based SPA router
    ├── app.js          # bootstrap
    ├── components/     # shared UI building blocks
    ├── pages/          # per-route views
    └── utils/
```

## Routes

| Path | Surface |
| --- | --- |
| `#/` | Public landing |
| `#/login` | Sign-in |
| `#/dashboard` | Manager attention view |
| `#/worker-tracker` | Manager drill-down |
| `#/tasks` | Manager + employee tasks |
| `#/calendar` | Employee calendar |
| `#/teams` | Team management / roster |
| `#/join` | Employee onboarding / join access |
| `#/profile` | Self profile |

## Run locally

Start the backend first (see [../backend](../backend)):

```bash
cd ../backend
npm install
npm run dev
```

Then serve the frontend statically:

```bash
cd frontend
python3 -m http.server 5500
```

Open <http://localhost:5500>.

## Demo accounts

After `npm run seed:demo-group` on the backend, these users exist:

- `olivia.hart@tasktrail.local`
- `ethan.reyes@tasktrail.local`
- `priya.shah@tasktrail.local`
- `nina.patel@tasktrail.local`
- `marcus.lee@tasktrail.local`

Use the password stored in `backend/.env` as `DEMO_USER_PASSWORD`.

## Notes

- Managers land on the attention-first dashboard and flow naturally into Worker Tracker, Tasks, or Teams.
- Employees land on Join Team if they have no active memberships, otherwise on Tasks.
- Self-profile edits save through `PATCH /api/v1/users/me` for `firstName`, `lastName`, `jobTitle`, `dateOfBirth`, and `address`.
- Manager team create/edit, membership changes, join-access regeneration, and recurring-task creation are all wired to the real API.
- Profile photo management and some manager-side employee creation controls remain presentation-only. The backend already supports `POST /api/v1/users` and URL-based avatar updates via `PATCH /api/v1/users/:userId/avatar`; those controls just need to be wired into the UI.
- Legacy backend endpoints for goals, productivity, and hours still exist but are no longer part of the live product flow.

## Backend surface used

The web client relies on the stable `/api/v1` surface — see the [API reference](../backend/docs/API_REFERENCE.md) and [frontend integration guide](../backend/docs/FRONTEND_INTEGRATION_GUIDE.md) for full details.

For repo-wide context, start at the [root README](../README.md).
