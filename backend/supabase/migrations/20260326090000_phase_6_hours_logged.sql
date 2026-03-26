create table if not exists public.hours_logged (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,
  task_id uuid references public.tasks (id) on delete set null,
  work_date date not null,
  hours numeric(5, 2) not null,
  note text,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint hours_logged_hours_range check (hours > 0 and hours <= 24),
  constraint hours_logged_note_length check (
    note is null or char_length(note) <= 2000
  )
);

create index if not exists idx_hours_logged_user_work_date
  on public.hours_logged (user_id, work_date desc);
create index if not exists idx_hours_logged_team_work_date
  on public.hours_logged (team_id, work_date desc);
create index if not exists idx_hours_logged_task_work_date
  on public.hours_logged (task_id, work_date desc);
create index if not exists idx_hours_logged_created_by
  on public.hours_logged (created_by_user_id, created_at desc);

drop trigger if exists set_hours_logged_updated_at on public.hours_logged;
create trigger set_hours_logged_updated_at
before update on public.hours_logged
for each row
execute function public.set_updated_at();

alter table public.hours_logged enable row level security;
