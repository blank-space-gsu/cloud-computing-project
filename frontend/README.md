# Frontend README

## Overview

This frontend is a plain HTML, CSS, and JavaScript single-page app for the Cloud-Based Workforce Task Management System. It uses hash-based routing and connects to the backend API under `/api/v1`.

The current UI is presentation-ready for the class demo and uses the validated backend API for authentication, dashboards, tasks, teams, goals, profile saving, and notifications. Backend logic remains isolated in `/backend`.

## What Was Built

- Public landing page before login
- Role-based sign-in flow
- Shared app shell with sidebar, header, modals, toasts, loading states, and empty states
- Manager dashboard with summary cards, charts, task board, deadlines, and team snapshots
- Employee dashboard with personal work, progress, and trend views
- Tasks page with manager and employee task workflows
- Goals page with target summaries and progress tracking
- Productivity page with charts and performance summaries
- Teams and people directory views
- Manager and employee profile pages
- Backend-backed self-profile editing on the profile page
- Backend-backed notification list, read, and dismiss actions
- Responsive TaskFlow styling across the app

## Frontend Structure

```text
frontend/
  index.html
  css/
    styles.css
  js/
    api.js
    app.js
    auth.js
    router.js
    components/
    pages/
    utils/
```

## Main Pages

- `#/` public landing page
- `#/login` sign-in screen
- `#/dashboard`
- `#/tasks`
- `#/productivity`
- `#/goals`
- `#/teams`
- `#/profile`

## Local Run

Start the backend first:

```bash
cd backend
npm install
npm run dev
```

From the frontend folder, start a static server:

```bash
cd frontend
python3 -m http.server 5500
```

Open `http://localhost:5500`.

## Demo Accounts

- `manager.demo@cloudcomputing.local`
- `employee.one@cloudcomputing.local`
- `employee.two@cloudcomputing.local`

Use the password stored in `backend/.env` as `DEMO_USER_PASSWORD`.

## Important Frontend Notes

- Manager flows default to the strongest seeded team experience after sign-in.
- The landing page does not reveal seeded database content before authentication.
- Self-profile edits save through `PATCH /api/v1/users/me` for `firstName`, `lastName`, `jobTitle`, `dateOfBirth`, and `address`.
- Manager team creation, team editing, and team membership add/remove actions are backed by the real API.
- Notifications load from the backend and support read/dismiss actions. The frontend keeps a safe local fallback only if the notification API is unavailable.
- Profile photo management and employee creation remain placeholder UI actions in the current frontend. Backend support exists for URL-based avatar updates and employee creation, but those specific controls are not wired yet; binary profile-photo upload is not implemented.
- Supervisor or team contact details use backend data where available and frontend-safe fallbacks where needed for demo presentation.

## Backend Endpoints Used

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/teams`
- `POST /api/v1/teams`
- `GET /api/v1/teams/:teamId`
- `PATCH /api/v1/teams/:teamId`
- `GET /api/v1/teams/:teamId/members`
- `POST /api/v1/teams/:teamId/members`
- `DELETE /api/v1/teams/:teamId/members/:userId`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `POST /api/v1/task-assignments`
- `GET /api/v1/dashboards/employee`
- `GET /api/v1/dashboards/manager`
- `GET /api/v1/productivity-metrics`
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/:goalId`
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:notificationId/read`
- `DELETE /api/v1/notifications/:notificationId`

## Backend Handoff List

These are the remaining frontend/backend handoff items if the team wants to polish beyond the validated demo scope:

- Wire Add Employee from the manager UI to the existing `POST /api/v1/users` endpoint
- Wire URL-based employee avatar updates from the manager side to `PATCH /api/v1/users/:userId/avatar`, or add binary upload support later if required
- Expand team directory contact data where roster responses do not include all desired fields
