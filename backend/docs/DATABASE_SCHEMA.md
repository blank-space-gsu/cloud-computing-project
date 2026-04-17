# Database Schema

## Overview

Phase 1 defines the normalized MVP schema for the TaskTrail backend. It is designed around the clarified MVP:

- managers assign work to employees
- employees see their assigned tasks
- managers see workload and completion visibility for their team

The schema is hosted in Supabase PostgreSQL and references `auth.users` for identity.

## Design Choices

### Enum Strategy

PostgreSQL enum types are used for small, stable value sets:

- `app_role`
- `team_membership_role`
- `team_membership_status`
- `team_membership_event_type`
- `team_access_token_type`
- `task_status`
- `task_priority`
- `task_update_type`

This is simpler than separate lookup tables for a student-managed project and keeps validation close to the database.

### Assignment History

`task_assignments` keeps reassignment history instead of overwriting a single assignee field on `tasks`. A partial unique index guarantees only one active assignee per task at a time.

### Overdue Tasks

Overdue is not stored as a task status. It is computed from:

- `due_at` is in the past
- task status is not `completed` or `cancelled`

This avoids conflicting stored values.

## Enum Types

### `public.app_role`

- `employee`
- `manager`
- `admin`

### `public.team_membership_role`

- `member`
- `manager`

### `public.team_membership_status`

- `active`
- `left`
- `removed`

### `public.team_membership_event_type`

- `added`
- `joined`
- `left`
- `rejoined`
- `removed`

### `public.team_access_token_type`

- `join_code`
- `invite_link`

### `public.task_status`

- `todo`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

### `public.task_priority`

- `low`
- `medium`
- `high`
- `urgent`

### `public.task_update_type`

- `created`
- `assigned`
- `updated`
- `completed`

### `public.goal_type`

- `sales_quota`

### `public.goal_scope`

- `user`
- `team`

### `public.goal_period`

- `weekly`
- `monthly`
- `quarterly`
- `yearly`

### `public.goal_status`

- `active`
- `cancelled`

## Tables

### `public.users`

**Purpose**
Stores application profile data for users whose identities live in `auth.users`.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | none | Primary key, foreign key to `auth.users(id)` |
| `email` | `text` | No | none | Unique application email |
| `first_name` | `text` | No | none | Employee or manager first name |
| `last_name` | `text` | No | none | Employee or manager last name |
| `job_title` | `text` | Yes | `null` | Position label for dashboards |
| `date_of_birth` | `date` | Yes | `null` | Optional profile-only birth date for self-service profile editing |
| `address` | `text` | Yes | `null` | Optional profile-only mailing or street address |
| `avatar_url` | `text` | Yes | `null` | URL-based avatar field used by roster/profile views |
| `app_role` | `public.app_role` | No | `'employee'` | Global application role |
| `is_active` | `boolean` | No | `true` | Soft-active flag |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `id -> auth.users(id)` on delete cascade

**Unique constraints**
- `users_email_key` on `email`

**Check constraints**
- `char_length(trim(first_name)) > 0`
- `char_length(trim(last_name)) > 0`
- `date_of_birth is null or date_of_birth <= current_date`
- `address is null or char_length(address) <= 500`
- `avatar_url is null or char_length(trim(avatar_url)) > 0`

**Recommended indexes**
- unique index on `email`
- index on `app_role`
- index on `is_active`

### `public.teams`

**Purpose**
Stores the teams that managers and employees belong to.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `name` | `text` | No | none | Team name |
| `description` | `text` | Yes | `null` | Optional team description |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Unique constraints**
- `teams_name_key` on `name`

**Check constraints**
- `char_length(trim(name)) > 0`

**Recommended indexes**
- unique index on `name`

### `public.team_members`

**Purpose**
Maps users to teams with a durable lifecycle so leave/rejoin history is preserved while active roster queries stay clean.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `team_id` | `uuid` | No | none | Foreign key to `teams(id)` |
| `user_id` | `uuid` | No | none | Foreign key to `users(id)` |
| `membership_role` | `public.team_membership_role` | No | `'member'` | Team-level role |
| `membership_status` | `public.team_membership_status` | No | `'active'` | Current lifecycle state |
| `joined_at` | `timestamptz` | No | `timezone('utc', now())` | First join timestamp |
| `left_at` | `timestamptz` | Yes | `null` | Set when the member leaves the team |
| `removed_at` | `timestamptz` | Yes | `null` | Set when a manager removes the member |
| `last_rejoined_at` | `timestamptz` | Yes | `null` | Most recent rejoin timestamp |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- composite primary key on (`team_id`, `user_id`)

**Foreign keys**
- `team_id -> teams(id)` on delete cascade
- `user_id -> users(id)` on delete cascade

**Unique constraints**
- covered by the composite primary key

**Check constraints**
- lifecycle consistency check:
  - `active` rows must not have `left_at` or `removed_at`
  - `left` rows must have `left_at`
  - `removed` rows must have `removed_at`

**Recommended indexes**
- index on `user_id`
- index on (`team_id`, `membership_role`)
- index on (`user_id`, `membership_status`)
- index on (`team_id`, `membership_status`, `membership_role`)
- partial index on (`team_id`, `membership_role`) where `membership_status = 'active'`

### `public.team_membership_events`

**Purpose**
Stores append-only membership lifecycle history for add/join/leave/rejoin/remove actions.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `team_id` | `uuid` | No | none | Foreign key to `teams(id)` |
| `user_id` | `uuid` | No | none | Foreign key to `users(id)` |
| `event_type` | `public.team_membership_event_type` | No | none | Lifecycle event |
| `membership_role` | `public.team_membership_role` | No | none | Role at the time of the event |
| `acted_by_user_id` | `uuid` | Yes | `null` | User who caused the event |
| `team_access_token_id` | `uuid` | Yes | `null` | Join access used for self-join/rejoin |
| `metadata` | `jsonb` | No | `'{}'::jsonb` | Event metadata object |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

### `public.team_access_tokens`

**Purpose**
Stores active join codes and invite-link tokens for self-join onboarding, including whether a token grants employee/member or manager membership.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `team_id` | `uuid` | No | none | Foreign key to `teams(id)` |
| `token_type` | `public.team_access_token_type` | No | none | `join_code` or `invite_link` |
| `granted_membership_role` | `public.team_membership_role` | No | `'member'` | Membership role created when the token is consumed |
| `token_value` | `text` | No | none | Actual join credential |
| `created_by_user_id` | `uuid` | No | none | Manager or admin who generated it |
| `expires_at` | `timestamptz` | Yes | `null` | Optional expiry |
| `revoked_at` | `timestamptz` | Yes | `null` | Set when access is rotated or revoked |
| `is_active` | `boolean` | No | `true` | Current usability flag |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Recommended indexes**
- unique index on `token_value`
- partial unique index on (`team_id`, `token_type`, `granted_membership_role`) where `is_active = true`
- composite index on (`team_id`, `token_type`, `granted_membership_role`, `is_active`)

### `public.tasks`

**Purpose**
Stores task definitions, scheduling information, and current progress state.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `team_id` | `uuid` | No | none | Team the task belongs to |
| `title` | `text` | No | none | Task title |
| `description` | `text` | Yes | `null` | Main task description |
| `notes` | `text` | Yes | `null` | Optional manager or employee notes |
| `status` | `public.task_status` | No | `'todo'` | Current task status |
| `priority` | `public.task_priority` | No | `'medium'` | Urgency level |
| `due_at` | `timestamptz` | Yes | `null` | Deadline timestamp |
| `week_start_date` | `date` | No | none | Monday of the planning week |
| `recurring_rule_id` | `uuid` | Yes | `null` | Source recurring rule when generated from a rule |
| `generated_for_date` | `date` | Yes | `null` | Occurrence date for generated recurring task instances |
| `estimated_hours` | `numeric(6,2)` | Yes | `null` | Optional estimate |
| `progress_percent` | `integer` | No | `0` | 0 to 100 progress tracker |
| `created_by_user_id` | `uuid` | No | none | User who created the task |
| `updated_by_user_id` | `uuid` | Yes | `null` | Last updater |
| `completed_at` | `timestamptz` | Yes | `null` | Completion timestamp |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `team_id -> teams(id)` on delete restrict
- `recurring_rule_id -> recurring_task_rules(id)` on delete set null
- `created_by_user_id -> users(id)` on delete restrict
- `updated_by_user_id -> users(id)` on delete set null

**Unique constraints**
- none

**Check constraints**
- `char_length(trim(title)) > 0`
- `progress_percent between 0 and 100`
- `estimated_hours is null or estimated_hours >= 0`
- `extract(isodow from week_start_date) = 1`

**Recommended indexes**
- index on `team_id`
- index on `status`
- index on `priority`
- index on `due_at`
- index on `week_start_date`
- index on `recurring_rule_id`
- index on `generated_for_date`
- composite index on (`team_id`, `week_start_date`)
- composite index on (`team_id`, `due_at`)
- partial unique index on (`recurring_rule_id`, `generated_for_date`) for generated recurring instances

### `public.recurring_task_rules`

**Purpose**
Stores lightweight recurring templates that generate real task instances for a team.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `team_id` | `uuid` | No | none | Owning team |
| `title` | `text` | No | none | Generated task title |
| `description` | `text` | Yes | `null` | Optional generated description |
| `priority` | `public.task_priority` | No | `'medium'` | Default task priority |
| `default_assignee_user_id` | `uuid` | Yes | `null` | Optional default employee assignee |
| `frequency` | `public.recurring_task_frequency` | No | none | `daily`, `weekly`, or `monthly` |
| `weekdays` | `integer[]` | Yes | `null` | Used only for weekly rules (`0-6`) |
| `day_of_month` | `integer` | Yes | `null` | Used only for monthly rules (`1-31`) |
| `due_time` | `time` | No | none | Due-time template for each occurrence |
| `starts_on` | `date` | No | none | First eligible occurrence date |
| `ends_on` | `date` | Yes | `null` | Optional rule end date |
| `is_active` | `boolean` | No | `true` | Enables future generation |
| `created_by_user_id` | `uuid` | No | none | Rule creator |
| `updated_by_user_id` | `uuid` | No | none | Last rule editor |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `team_id -> teams(id)` on delete cascade
- `default_assignee_user_id -> users(id)` on delete set null
- `created_by_user_id -> users(id)` on delete restrict
- `updated_by_user_id -> users(id)` on delete restrict

**Check constraints**
- `char_length(trim(title)) > 0`
- `ends_on is null or ends_on >= starts_on`
- daily rules must not carry weekly/monthly config
- weekly rules must include one or more weekdays
- monthly rules must include `day_of_month between 1 and 31`
- weekday arrays can only contain `0-6`

**Recommended indexes**
- index on (`team_id`, `is_active`, `starts_on`)
- index on `default_assignee_user_id`

### `public.task_assignments`

**Purpose**
Tracks which user currently owns a task while preserving reassignment history.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `task_id` | `uuid` | No | none | Foreign key to `tasks(id)` |
| `assignee_user_id` | `uuid` | No | none | Assigned employee |
| `assigned_by_user_id` | `uuid` | No | none | Manager who assigned the task |
| `assignment_note` | `text` | Yes | `null` | Optional assignment context |
| `assigned_at` | `timestamptz` | No | `timezone('utc', now())` | Assignment timestamp |
| `unassigned_at` | `timestamptz` | Yes | `null` | Set when reassigned or cleared |
| `is_active` | `boolean` | No | `true` | Marks the current assignment |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `task_id -> tasks(id)` on delete cascade
- `assignee_user_id -> users(id)` on delete restrict
- `assigned_by_user_id -> users(id)` on delete restrict

**Unique constraints**
- partial unique index to allow only one active assignment per task

**Check constraints**
- active assignments must not have `unassigned_at`

### `public.task_updates`

**Purpose**
Stores append-only task activity history for creation, assignment, progress updates, and completion updates while `tasks` remains the current-state snapshot.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `task_id` | `uuid` | No | none | Foreign key to `tasks(id)` |
| `updated_by_user_id` | `uuid` | No | none | User who performed the update |
| `update_type` | `public.task_update_type` | No | none | `created`, `assigned`, `updated`, or `completed` |
| `status_after` | `public.task_status` | Yes | `null` | Task status after the update |
| `progress_percent_after` | `integer` | Yes | `null` | Progress value after the update |
| `note` | `text` | Yes | `null` | Notes snapshot or assignment context |
| `assignee_user_id` | `uuid` | Yes | `null` | Set for assignment events |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Event timestamp |

**Primary key**
- `id`

**Foreign keys**
- `task_id -> tasks(id)` on delete cascade
- `updated_by_user_id -> users(id)` on delete restrict
- `assignee_user_id -> users(id)` on delete set null

**Check constraints**
- `progress_percent_after is null or progress_percent_after between 0 and 100`

**Recommended indexes**
- index on (`task_id`, `created_at desc`)
- index on (`updated_by_user_id`, `created_at desc`)

### `public.notifications`

**Purpose**
Stores user-targeted in-app notifications for team membership changes and task due reminders.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | No | none | Notification recipient |
| `type` | `text` | No | none | Notification type such as `team_added`, `task_due_soon`, or `task_overdue` |
| `title` | `text` | No | none | Short notification headline |
| `message` | `text` | No | none | Notification body copy |
| `task_id` | `uuid` | Yes | `null` | Optional task reference |
| `team_id` | `uuid` | Yes | `null` | Optional team reference |
| `dedupe_key` | `text` | Yes | `null` | Optional idempotency key for lazy-generated due alerts |
| `read_at` | `timestamptz` | Yes | `null` | Set when the user opens or marks the notification read |
| `dismissed_at` | `timestamptz` | Yes | `null` | Set when the user archives the notification |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `user_id -> users(id)` on delete cascade
- `task_id -> tasks(id)` on delete set null
- `team_id -> teams(id)` on delete set null

**Unique constraints**
- partial unique index on `dedupe_key` when it is not null

**Recommended indexes**
- index on (`user_id`, `created_at desc`)
- index on (`user_id`, `read_at`, `dismissed_at`)
- index on `task_id`
- index on `team_id`
- inactive assignments must have `unassigned_at`

**Recommended indexes**
- partial unique index on `task_id where is_active = true`
- index on `assignee_user_id`
- composite index on (`assignee_user_id`, `is_active`)
- composite index on (`assigned_by_user_id`, `assigned_at desc`)

## Row Level Security

All MVP tables are created with RLS enabled, but no public policies are added in Phase 1. This reduces the risk of accidental direct client access while the backend remains the primary data access layer.

## Future Modules

Phase 6 adds `hours_logged` as a separate migration after the MVP schema proved stable.

### `public.hours_logged`

**Purpose**
Stores self-reported work hours for a user, optionally linked to a task.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | No | none | User who performed the work |
| `team_id` | `uuid` | No | none | Team context for the logged work |
| `task_id` | `uuid` | Yes | `null` | Optional task the hours belong to |
| `work_date` | `date` | No | none | Calendar date of the work performed |
| `hours` | `numeric(5,2)` | No | none | Logged duration, constrained to > 0 and <= 24 |
| `note` | `text` | Yes | `null` | Optional work log note |
| `created_by_user_id` | `uuid` | No | none | User who created the entry |
| `updated_by_user_id` | `uuid` | Yes | `null` | Last updater, reserved for future edit flows |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `user_id -> users(id)` on delete restrict
- `team_id -> teams(id)` on delete restrict
- `task_id -> tasks(id)` on delete set null
- `created_by_user_id -> users(id)` on delete restrict
- `updated_by_user_id -> users(id)` on delete set null

**Unique constraints**
- none

**Check constraints**
- `hours > 0 and hours <= 24`
- `note is null or char_length(note) <= 2000`

**Recommended indexes**
- composite index on (`user_id`, `work_date desc`)
- composite index on (`team_id`, `work_date desc`)
- composite index on (`task_id`, `work_date desc`)
- composite index on (`created_by_user_id`, `created_at desc`)

### `public.goals`

**Purpose**
Stores measurable goals and quotas. Phase 8 uses this table for sales quotas with either user or team scope.

| Column | Type | Null | Default | Notes |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | No | `extensions.gen_random_uuid()` | Primary key |
| `team_id` | `uuid` | No | none | Team that owns the goal |
| `target_user_id` | `uuid` | Yes | `null` | Required for user-scoped goals, null for team-scoped goals |
| `title` | `text` | No | none | Goal or quota title |
| `description` | `text` | Yes | `null` | Optional supporting description |
| `goal_type` | `public.goal_type` | No | `'sales_quota'` | Generic goal category |
| `scope` | `public.goal_scope` | No | `'user'` | Whether the goal targets one user or a whole team |
| `period` | `public.goal_period` | No | `'monthly'` | Reporting period label |
| `start_date` | `date` | No | none | Goal tracking start date |
| `end_date` | `date` | No | none | Goal tracking end date |
| `target_value` | `numeric(12,2)` | No | none | The quota or goal target |
| `actual_value` | `numeric(12,2)` | No | `0` | The currently achieved amount |
| `unit` | `text` | No | `'USD'` | Frontend label for the target, for example `USD` or `deals` |
| `status` | `public.goal_status` | No | `'active'` | Goal lifecycle state |
| `created_by_user_id` | `uuid` | No | none | Manager or admin who created the goal |
| `updated_by_user_id` | `uuid` | Yes | `null` | Last updater |
| `created_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |
| `updated_at` | `timestamptz` | No | `timezone('utc', now())` | Audit timestamp |

**Primary key**
- `id`

**Foreign keys**
- `team_id -> teams(id)` on delete restrict
- `target_user_id -> users(id)` on delete restrict
- `created_by_user_id -> users(id)` on delete restrict
- `updated_by_user_id -> users(id)` on delete set null

**Unique constraints**
- none

**Check constraints**
- `char_length(trim(title)) > 0`
- `char_length(trim(unit)) > 0`
- `start_date <= end_date`
- `target_value > 0`
- `actual_value >= 0`
- `(scope = 'team' and target_user_id is null) or (scope = 'user' and target_user_id is not null)`

**Recommended indexes**
- index on `team_id`
- index on `target_user_id`
- index on `goal_type`
- index on `status`
- index on `period`
- index on `end_date`
- composite index on (`team_id`, `end_date`)
- composite index on (`target_user_id`, `status`)

Still planned after Phase 8:

- optional task comments or updates
- deployment-focused operational support if needed later

Productivity reporting in Phase 7 is computed directly from `tasks`, `task_assignments`, and `hours_logged`, and goal progress in Phase 8 is computed directly from `goals`, so no separate summary tables were introduced yet.

## Phase 2 Additions

Phase 2 adds auth-profile synchronization through a separate migration:

- trigger function: `public.handle_auth_user_profile_sync()`
- triggers: `on_auth_user_created` and `on_auth_user_updated` on `auth.users`

This lets backend-managed or admin-created Supabase auth users keep matching rows in `public.users` aligned using metadata for:

- `first_name`
- `last_name`
- `job_title`
- `app_role`

## Phase 3 Read Models

Phase 3 does not change the SQL schema. It exposes read APIs against the existing MVP tables:

- `GET /api/v1/users/me` reads the authenticated app user profile assembled during auth resolution
- `GET /api/v1/teams` reads scoped team summaries from `teams` and `team_members`
- `GET /api/v1/teams/:teamId` reads a single scoped team summary
- `GET /api/v1/teams/:teamId/members` reads roster data from `team_members` joined to `users`

The team summary responses currently surface:

- `id`
- `name`
- `description`
- `membershipRole`
- `memberCount`
- `managerCount`
- `canManageTeam`
- `createdAt`
- `updatedAt`

The team roster responses currently surface:

- `id`
- `firstName`
- `lastName`
- `fullName`
- `jobTitle`
- `appRole`
- `membershipRole`

These Phase 3 read models intentionally expose only the fields needed for the MVP manager roster and team-selection flows. Task data remains in Phase 4.

## Phase 4 Operational Model

Phase 4 activates the core `tasks` and `task_assignments` tables through the REST API. Phase 12 extends the same task loop with `task_updates` so assignment and employee self-reporting history remain durable.

Task CRUD behavior now relies on:

- `tasks` as the source of truth for title, deadline, priority, planning week, notes, progress, and completion state
- `task_assignments` as the source of truth for the current assignee plus reassignment history
- `task_updates` as the append-only activity history for creation, assignment, progress changes, and completion
- the partial unique index on active assignments to guarantee one current assignee per task in MVP scope

Phase 4 API responses compute these frontend-facing values at read time instead of storing them:

- `timeRemainingSeconds`
- `isOverdue`
- `isDueSoon`

Task visibility in Phase 4 follows these rules:

- managers can list and manage tasks only for teams where `team_members.membership_role = 'manager'`
- employees can only read tasks with an active assignment to themselves
- admins can access all tasks

Assignment validation in Phase 4 requires:

- the task belongs to a team the acting manager or admin can manage
- the assignee belongs to the same team
- the assignee is active
- the assignee has `app_role = 'employee'`

## Phase 5 Read Models

Phase 5 does not change the SQL schema. It adds dashboard read models that aggregate existing task and assignment data:

- `GET /api/v1/dashboards/employee` summarizes the logged-in employee's assigned tasks
- `GET /api/v1/dashboards/manager` summarizes tasks for manageable teams

Phase 5 aggregates are computed from:

- `tasks`
- active rows in `task_assignments`
- `teams`
- `team_members`
- `users`

These dashboard read models stay derived and do not introduce summary tables yet, which keeps the MVP easier to explain and maintain.
