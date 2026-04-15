alter table public.users
  add column if not exists date_of_birth date,
  add column if not exists address text,
  add column if not exists avatar_url text;

alter table public.users
  drop constraint if exists users_date_of_birth_not_in_future,
  add constraint users_date_of_birth_not_in_future
    check (date_of_birth is null or date_of_birth <= current_date);

alter table public.users
  drop constraint if exists users_address_length,
  add constraint users_address_length
    check (address is null or char_length(address) <= 500);

alter table public.users
  drop constraint if exists users_avatar_url_not_blank,
  add constraint users_avatar_url_not_blank
    check (avatar_url is null or char_length(trim(avatar_url)) > 0);

create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  task_id uuid references public.tasks (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  dedupe_key text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notifications_type_not_blank check (char_length(trim(type)) > 0),
  constraint notifications_title_not_blank check (char_length(trim(title)) > 0),
  constraint notifications_message_not_blank check (char_length(trim(message)) > 0),
  constraint notifications_dedupe_key_not_blank check (
    dedupe_key is null or char_length(trim(dedupe_key)) > 0
  )
);

create unique index if not exists ux_notifications_dedupe_key
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_user_created_at
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_read_dismissed
  on public.notifications (user_id, read_at, dismissed_at);
create index if not exists idx_notifications_task_id
  on public.notifications (task_id);
create index if not exists idx_notifications_team_id
  on public.notifications (team_id);

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

alter table public.notifications enable row level security;
