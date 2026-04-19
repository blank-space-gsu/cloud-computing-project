do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'recurring_task_frequency'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.recurring_task_frequency as enum ('daily', 'weekly', 'monthly');
  end if;
end $$;

create table if not exists public.recurring_task_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null,
  description text,
  priority public.task_priority not null default 'medium',
  default_assignee_user_id uuid references public.users (id) on delete set null,
  frequency public.recurring_task_frequency not null,
  weekdays integer[],
  day_of_month integer,
  due_time time not null,
  starts_on date not null,
  ends_on date,
  is_active boolean not null default true,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  updated_by_user_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_task_rules_title_not_blank
    check (char_length(trim(title)) > 0),
  constraint recurring_task_rules_date_order
    check (ends_on is null or ends_on >= starts_on),
  constraint recurring_task_rules_frequency_shape
    check (
      (frequency = 'daily' and weekdays is null and day_of_month is null)
      or (frequency = 'weekly' and weekdays is not null and cardinality(weekdays) > 0 and day_of_month is null)
      or (frequency = 'monthly' and weekdays is null and day_of_month between 1 and 31)
    ),
  constraint recurring_task_rules_weekday_values
    check (
      weekdays is null
      or weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
    )
);

alter table public.tasks
  add column if not exists recurring_rule_id uuid references public.recurring_task_rules (id) on delete set null,
  add column if not exists generated_for_date date;

create index if not exists idx_recurring_task_rules_team_active
  on public.recurring_task_rules (team_id, is_active, starts_on);
create index if not exists idx_recurring_task_rules_default_assignee
  on public.recurring_task_rules (default_assignee_user_id);
create index if not exists idx_tasks_recurring_rule_id
  on public.tasks (recurring_rule_id);
create index if not exists idx_tasks_generated_for_date
  on public.tasks (generated_for_date);
create unique index if not exists ux_tasks_recurring_rule_generated_for_date
  on public.tasks (recurring_rule_id, generated_for_date)
  where recurring_rule_id is not null;

drop trigger if exists set_recurring_task_rules_updated_at on public.recurring_task_rules;
create trigger set_recurring_task_rules_updated_at
before update on public.recurring_task_rules
for each row
execute function public.set_updated_at();

alter table public.recurring_task_rules enable row level security;
