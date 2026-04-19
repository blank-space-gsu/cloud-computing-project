# TaskTrail Mobile

Flutter mobile client foundation for TaskTrail.

Module 0 sets up the mobile app shell only:

- role-aware routing skeleton
- premium mobile-first theme foundation
- environment-aware API configuration
- auth/session storage stubs
- manager and employee placeholder shells
- Android emulator-ready local development defaults

This module does **not** implement the full backend flows yet. It preserves the live web/backend product structure so future mobile modules can wire real contracts without reworking the architecture.

## Product Spine

Manager mobile shell:

- Dashboard
- Worker Tracker
- Tasks
- Teams
- Profile

Employee mobile shell:

- Tasks
- Calendar
- Teams
- Join Team
- Profile

## Run the app

From [/Users/admin/Documents/GitHub/cloud-computing-project/mobile](/Users/admin/Documents/GitHub/cloud-computing-project/mobile):

```bash
flutter pub get
flutter run -d emulator-5554 \
  --dart-define=TASKTRAIL_ENV=development \
  --dart-define=TASKTRAIL_API_BASE_URL=http://10.0.2.2:4000/api/v1
```

Production API default:

```text
https://api.tasktrail.site/api/v1
```

If no `TASKTRAIL_API_BASE_URL` is supplied:

- `development` defaults to `http://10.0.2.2:4000/api/v1`
- `production` defaults to `https://api.tasktrail.site/api/v1`

## Folder Structure

```text
mobile/
  lib/
    main.dart
    src/
      app/
      core/
      features/
      shared/
  docs/
    ARCHITECTURE.md
```

Highlights:

- `src/app/`
  - top-level app bootstrap and router
- `src/core/`
  - environment config
  - models
  - API client foundation
  - secure session storage
  - theme
- `src/features/`
  - mobile feature modules matching the live TaskTrail product
- `src/shared/`
  - reusable navigation and placeholder widgets

## Architecture Notes

See [ARCHITECTURE.md](/Users/admin/Documents/GitHub/cloud-computing-project/mobile/docs/ARCHITECTURE.md) for the detailed Module 0 architecture and next-module sequencing.

## Module 0 Boundaries

Included:

- serious Flutter project scaffold
- emulator-ready Android setup
- router skeleton and role guards
- placeholder mobile screens for the real TaskTrail flows
- auth/session persistence stubs for preview mode
- shared API client/service foundations

Not included yet:

- real signup/login forms against the backend
- live API-backed dashboards, tasks, teams, worker tracker, calendar, or profile
- deep links, push notifications, offline behavior, or production polish beyond foundation
