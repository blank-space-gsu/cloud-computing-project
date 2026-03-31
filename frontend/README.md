# Frontend README

## Overview

This frontend is a plain HTML, CSS, and JavaScript single-page app for the Cloud-Based Workforce Task Management System. It uses hash-based routing and connects to the backend API under `/api/v1`.

The current UI is presentation-ready for the class demo and stays frontend-only. Backend logic and API behavior were not changed as part of this frontend work.

## What Was Built

- Public landing page before login
- Role-based sign-in flow
- Shared app shell with sidebar, header, modals, toasts, loading states, and empty states
- Manager dashboard with summary cards, charts, task board, deadlines, and team snapshots
- Employee dashboard with personal work, progress, and trend views
- Tasks page with manager and employee task workflows
- Goals page with target summaries and progress tracking
- Hours page with logging and reporting views
- Productivity page with charts and performance summaries
- Teams and people directory views
- Manager and employee profile pages
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
- `#/hours`
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
- Profile photo management and employee creation are not implemented as real backend actions yet. The UI leaves those as clear placeholders for backend follow-up.
- Supervisor or team contact details use backend data where available and frontend-safe fallbacks where needed for demo presentation.

## Backend Endpoints Used

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/users/me`
- `GET /api/v1/teams`
- `GET /api/v1/teams/:teamId`
- `GET /api/v1/teams/:teamId/members`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `POST /api/v1/task-assignments`
- `GET /api/v1/dashboards/employee`
- `GET /api/v1/dashboards/manager`
- `GET /api/v1/hours-logged`
- `POST /api/v1/hours-logged`
- `GET /api/v1/productivity-metrics`
- `GET /api/v1/goals`
- `POST /api/v1/goals`
- `PATCH /api/v1/goals/:goalId`

## Backend Handoff List

These are the remaining items that would need backend support if the team wants them to become fully real features:

- Add employee from the manager UI
- Upload or change employee profile photos from the manager side
- Expand team directory contact data where roster responses do not include all desired fields
