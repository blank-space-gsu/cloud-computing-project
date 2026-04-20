create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'app_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_role as enum ('employee', 'manager', 'admin');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_membership_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.team_membership_role as enum ('member', 'manager');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'task_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.task_status as enum (
      'todo',
      'in_progress',
      'blocked',
      'completed',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'task_priority'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  job_title text,
  app_role public.app_role not null default 'employee',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint users_first_name_not_blank check (char_length(trim(first_name)) > 0),
  constraint users_last_name_not_blank check (char_length(trim(last_name)) > 0)
);

create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint teams_name_not_blank check (char_length(trim(name)) > 0)
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  membership_role public.team_membership_role not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  title text not null,
  description text,
  notes text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  week_start_date date not null,
  estimated_hours numeric(6, 2),
  progress_percent integer not null default 0,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  updated_by_user_id uuid references public.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tasks_title_not_blank check (char_length(trim(title)) > 0),
  constraint tasks_progress_percent_range check (progress_percent between 0 and 100),
  constraint tasks_estimated_hours_non_negative check (
    estimated_hours is null or estimated_hours >= 0
  ),
  constraint tasks_week_start_is_monday check (extract(isodow from week_start_date) = 1)
);

create table if not exists public.task_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  assignee_user_id uuid not null references public.users (id) on delete restrict,
  assigned_by_user_id uuid not null references public.users (id) on delete restrict,
  assignment_note text,
  assigned_at timestamptz not null default timezone('utc', now()),
  unassigned_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint task_assignments_active_consistency check (
    (is_active = true and unassigned_at is null)
    or (is_active = false and unassigned_at is not null)
  )
);

create index if not exists idx_users_app_role on public.users (app_role);
create index if not exists idx_users_is_active on public.users (is_active);

create index if not exists idx_team_members_user_id on public.team_members (user_id);
create index if not exists idx_team_members_team_role
  on public.team_members (team_id, membership_role);

create index if not exists idx_tasks_team_id on public.tasks (team_id);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_priority on public.tasks (priority);
create index if not exists idx_tasks_due_at on public.tasks (due_at);
create index if not exists idx_tasks_week_start_date on public.tasks (week_start_date);
create index if not exists idx_tasks_team_week on public.tasks (team_id, week_start_date);
create index if not exists idx_tasks_team_due_at on public.tasks (team_id, due_at);

create index if not exists idx_task_assignments_assignee on public.task_assignments (assignee_user_id);
create index if not exists idx_task_assignments_assignee_active
  on public.task_assignments (assignee_user_id, is_active);
create index if not exists idx_task_assignments_assigner_assigned_at
  on public.task_assignments (assigned_by_user_id, assigned_at desc);
create unique index if not exists ux_task_assignments_one_active_task
  on public.task_assignments (task_id)
  where is_active = true;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists set_teams_updated_at on public.teams;
create trigger set_teams_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_members_updated_at on public.team_members;
create trigger set_team_members_updated_at
before update on public.team_members
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_task_assignments_updated_at on public.task_assignments;
create trigger set_task_assignments_updated_at
before update on public.task_assignments
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
