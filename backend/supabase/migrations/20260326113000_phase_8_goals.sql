do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'goal_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.goal_type as enum ('sales_quota');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'goal_scope'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.goal_scope as enum ('user', 'team');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'goal_period'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.goal_period as enum ('weekly', 'monthly', 'quarterly', 'yearly');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'goal_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.goal_status as enum ('active', 'cancelled');
  end if;
end $$;

create table if not exists public.goals (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete restrict,
  target_user_id uuid references public.users (id) on delete restrict,
  title text not null,
  description text,
  goal_type public.goal_type not null default 'sales_quota',
  scope public.goal_scope not null default 'user',
  period public.goal_period not null default 'monthly',
  start_date date not null,
  end_date date not null,
  target_value numeric(12, 2) not null,
  actual_value numeric(12, 2) not null default 0,
  unit text not null default 'USD',
  status public.goal_status not null default 'active',
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_title_not_blank check (char_length(trim(title)) > 0),
  constraint goals_unit_not_blank check (char_length(trim(unit)) > 0),
  constraint goals_date_range_valid check (start_date <= end_date),
  constraint goals_target_value_positive check (target_value > 0),
  constraint goals_actual_value_non_negative check (actual_value >= 0),
  constraint goals_scope_target_consistency check (
    (scope = 'team' and target_user_id is null)
    or (scope = 'user' and target_user_id is not null)
  )
);

create index if not exists idx_goals_team_id on public.goals (team_id);
create index if not exists idx_goals_target_user_id on public.goals (target_user_id);
create index if not exists idx_goals_goal_type on public.goals (goal_type);
create index if not exists idx_goals_status on public.goals (status);
create index if not exists idx_goals_period on public.goals (period);
create index if not exists idx_goals_end_date on public.goals (end_date);
create index if not exists idx_goals_team_end_date on public.goals (team_id, end_date);
create index if not exists idx_goals_target_user_status
  on public.goals (target_user_id, status);

drop trigger if exists set_goals_updated_at on public.goals;
create trigger set_goals_updated_at
before update on public.goals
for each row
execute function public.set_updated_at();

alter table public.goals enable row level security;
