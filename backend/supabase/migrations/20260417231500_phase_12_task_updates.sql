do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'task_update_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.task_update_type as enum (
      'created',
      'assigned',
      'updated',
      'completed'
    );
  end if;
end $$;

create table if not exists public.task_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  updated_by_user_id uuid not null references public.users (id) on delete restrict,
  update_type public.task_update_type not null,
  status_after public.task_status,
  progress_percent_after integer,
  note text,
  assignee_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint task_updates_progress_percent_after_range
    check (
      progress_percent_after is null
      or (progress_percent_after >= 0 and progress_percent_after <= 100)
    )
);

create index if not exists idx_task_updates_task_created_at
  on public.task_updates (task_id, created_at desc);
create index if not exists idx_task_updates_user_created_at
  on public.task_updates (updated_by_user_id, created_at desc);

insert into public.task_updates (
  task_id,
  updated_by_user_id,
  update_type,
  status_after,
  progress_percent_after,
  note,
  created_at
)
select
  t.id,
  t.created_by_user_id,
  'created'::public.task_update_type,
  t.status,
  t.progress_percent,
  t.notes,
  t.created_at
from public.tasks t
where not exists (
  select 1
  from public.task_updates tu
  where tu.task_id = t.id
);
