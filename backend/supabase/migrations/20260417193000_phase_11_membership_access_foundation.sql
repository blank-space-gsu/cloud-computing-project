do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'team_membership_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.team_membership_status as enum ('active', 'left', 'removed');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_membership_event_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.team_membership_event_type as enum (
      'added',
      'joined',
      'left',
      'rejoined',
      'removed'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'team_access_token_type'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.team_access_token_type as enum ('join_code', 'invite_link');
  end if;
end $$;

alter table public.team_members
  add column if not exists membership_status public.team_membership_status not null default 'active',
  add column if not exists joined_at timestamptz not null default timezone('utc', now()),
  add column if not exists left_at timestamptz,
  add column if not exists removed_at timestamptz,
  add column if not exists last_rejoined_at timestamptz;

update public.team_members
set joined_at = coalesce(joined_at, created_at)
where joined_at is null;

alter table public.team_members
  drop constraint if exists team_members_status_consistency,
  add constraint team_members_status_consistency
    check (
      (membership_status = 'active' and left_at is null and removed_at is null)
      or (membership_status = 'left' and left_at is not null and removed_at is null)
      or (membership_status = 'removed' and removed_at is not null)
    );

create table if not exists public.team_membership_events (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  event_type public.team_membership_event_type not null,
  membership_role public.team_membership_role not null,
  acted_by_user_id uuid references public.users (id) on delete set null,
  team_access_token_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_membership_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.team_access_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  token_type public.team_access_token_type not null,
  token_value text not null unique,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_access_tokens_value_not_blank
    check (char_length(trim(token_value)) > 0),
  constraint team_access_tokens_revoked_consistency
    check (
      (is_active = true and revoked_at is null)
      or (is_active = false and revoked_at is not null)
    )
);

alter table public.team_membership_events
  drop constraint if exists team_membership_events_access_token_fk,
  add constraint team_membership_events_access_token_fk
    foreign key (team_access_token_id)
    references public.team_access_tokens (id)
    on delete set null;

create index if not exists idx_team_members_user_status
  on public.team_members (user_id, membership_status);
create index if not exists idx_team_members_team_status_role
  on public.team_members (team_id, membership_status, membership_role);
create index if not exists idx_team_members_active_team_role
  on public.team_members (team_id, membership_role)
  where membership_status = 'active';

create index if not exists idx_team_membership_events_team_user_created_at
  on public.team_membership_events (team_id, user_id, created_at desc);
create index if not exists idx_team_membership_events_user_created_at
  on public.team_membership_events (user_id, created_at desc);

create index if not exists idx_team_access_tokens_team_type_active
  on public.team_access_tokens (team_id, token_type, is_active);
create unique index if not exists ux_team_access_tokens_one_active_type
  on public.team_access_tokens (team_id, token_type)
  where is_active = true;
create index if not exists idx_team_access_tokens_token_value
  on public.team_access_tokens (token_value);

drop trigger if exists set_team_membership_events_updated_at on public.team_membership_events;
create trigger set_team_membership_events_updated_at
before update on public.team_membership_events
for each row
execute function public.set_updated_at();

drop trigger if exists set_team_access_tokens_updated_at on public.team_access_tokens;
create trigger set_team_access_tokens_updated_at
before update on public.team_access_tokens
for each row
execute function public.set_updated_at();

alter table public.team_membership_events enable row level security;
alter table public.team_access_tokens enable row level security;
