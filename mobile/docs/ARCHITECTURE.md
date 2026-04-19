# TaskTrail Mobile Architecture (Module 0)

## Goal

Provide a production-minded Flutter foundation for the TaskTrail mobile client without rebuilding backend logic.

Module 0 establishes the mobile architecture only. Real backend feature wiring starts in later modules.

## Core Principles

- Preserve the live TaskTrail product spine
- Use the same backend contracts as the web app
- Keep the mobile client modular and role-aware
- Design for phones first, not desktop dashboards shrunk down
- Favor calm, premium, touch-friendly surfaces

## Module Layout

```text
lib/src/
  app/
    router/
      app_router.dart
      app_routes.dart
    tasktrail_mobile_app.dart
  core/
    config/
      app_config.dart
    models/
      app_role.dart
      app_user.dart
    network/
      tasktrail_api_client.dart
    storage/
      session_store.dart
    theme/
      tasktrail_theme.dart
  features/
    auth/
      application/
      data/
      domain/
      presentation/
    dashboard/
    worker_tracker/
    tasks/
    teams/
    join/
    calendar/
    profile/
  shared/
    navigation/
    widgets/
```

## Routing Strategy

Module 0 uses `go_router` with role-aware redirect logic.

Top-level routes:

- `/splash`
- `/auth`
- `/manager/...`
- `/employee/...`

Why this shape:

- keeps manager and employee shells cleanly separated
- makes route guards simple and explicit
- lets later modules add deep links and detail screens without rethinking access control

## Auth / Session Foundation

Module 0 intentionally avoids fake backend auth flows.

What exists now:

- `AuthController` for session/bootstrap state
- `AuthRepository` abstraction for future backend auth wiring
- `SessionStore` using `flutter_secure_storage`
- preview-session entry points so the emulator can validate real role shells now

What Module 1 should add:

- live `POST /auth/login`
- live `POST /auth/signup`
- verification-state handling
- `GET /auth/me` restore flow
- logout/session refresh rules

## API Foundation

`TaskTrailApiClient` wraps `dio` and already understands:

- environment-selected API base URL
- bearer-token injection from stored session
- future shared request handling

Module 0 does not yet map backend envelopes into typed repositories, but the foundation is ready for it.

## Environment Strategy

`AppConfig.fromEnvironment()` supports:

- `TASKTRAIL_ENV`
- `TASKTRAIL_API_BASE_URL`

Defaults:

- development -> `http://10.0.2.2:4000/api/v1`
- production -> `https://api.tasktrail.site/api/v1`

This keeps emulator development convenient while staying aligned to the live production API.

## Android Dev Networking

For Android emulator development, cleartext HTTP is enabled only for `debug` and `profile` manifests.

That keeps local backend development working without weakening the main release manifest unnecessarily.

## Recommended Module Sequence

1. **Module 1**
   Real auth, signup/login, verification-return handling, session restore
2. **Module 2**
   Teams + Join Team + role-aware zero-team flow
3. **Module 3**
   Task execution loop for manager and employee
4. **Module 4**
   Calendar + Worker Tracker live data
5. **Module 5**
   Profile + notifications + recurring task flows

## Notes for Future Contributors

- Keep backend-contract knowledge in repositories/services, not in widgets
- Treat manager and employee mobile shells as separate UXs sharing infrastructure
- Do not replicate dense web layouts in Flutter
- Preserve the product spine:
  - Manager: Dashboard, Worker Tracker, Tasks, Teams, Profile
  - Employee: Tasks, Calendar, Teams, Join Team, Profile
