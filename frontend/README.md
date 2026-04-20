# Frontend README

## Overview

This frontend is a plain HTML, CSS, and JavaScript single-page app for TaskTrail. It uses hash-based routing and connects to the backend API under `/api/v1`.

The live UI is now a focused team task-flow product. It uses the validated backend API for authentication, team join access, tasks, Worker Tracker, calendar, and profile saving. Backend logic remains isolated in `/backend`.

## What Was Built

- Public landing page before login
- Role-based sign-in flow
- Shared app shell with sidebar, header, modals, toasts, loading states, and empty states
- Manager Dashboard, Worker Tracker, Tasks, Teams, and Profile
- Employee Join Team, Tasks, Calendar, Teams, and Profile
- Team join access management for managers
- Backend-backed self-profile editing on the profile page
- Responsive TaskTrail styling across the app

Retired from the live app flow:

- Goals page
- Productivity page
- Employee dashboard route

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
- `#/dashboard` manager attention view
- `#/worker-tracker` manager drilldown view
- `#/tasks`
- `#/calendar` employee-only
- `#/teams`
- `#/join` employee onboarding / join access
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

- `olivia.hart@tasktrail.local`
- `ethan.reyes@tasktrail.local`
- `priya.shah@tasktrail.local`
- `nina.patel@tasktrail.local`
- `marcus.lee@tasktrail.local`

Use the password stored in `backend/.env` as `DEMO_USER_PASSWORD`.

## Important Frontend Notes

- Managers land on the attention-first dashboard and then move naturally into Worker Tracker, Tasks, or Teams.
- Employees land on Join Team if they have no active memberships, otherwise on Tasks.
- Self-profile edits save through `PATCH /api/v1/users/me` for `firstName`, `lastName`, `jobTitle`, `dateOfBirth`, and `address`.
- Manager team creation, team editing, team membership add/remove, join-access regeneration, and recurring-task creation are backed by the real API.
- Profile photo management and employee creation remain placeholder UI actions in the current frontend. Backend support exists for URL-based avatar updates and employee creation, but those specific controls are not wired yet; binary profile-photo upload is not implemented.
- Legacy backend endpoints for goals, productivity, and hours still exist, but they are no longer part of the live frontend product path.

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
- `GET /api/v1/teams/:teamId/join-access`
- `POST /api/v1/teams/:teamId/join-access/regenerate`
- `POST /api/v1/team-join`
- `POST /api/v1/teams/:teamId/members/me/leave`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:taskId`
- `PATCH /api/v1/tasks/:taskId`
- `DELETE /api/v1/tasks/:taskId`
- `POST /api/v1/task-assignments`
- `GET /api/v1/dashboards/manager`
- `GET /api/v1/worker-tracker`
- `POST /api/v1/recurring-task-rules`

## Backend Handoff List

These are the remaining frontend/backend handoff items if the team wants to polish beyond the validated demo scope:

- Wire Add Employee from the manager UI to the existing `POST /api/v1/users` endpoint
- Wire URL-based employee avatar updates from the manager side to `PATCH /api/v1/users/:userId/avatar`, or add binary upload support later if required
- Expand team directory contact data where roster responses do not include all desired fields
