alter table public.team_access_tokens
  add column if not exists granted_membership_role public.team_membership_role not null default 'member';

drop index if exists ux_team_access_tokens_one_active_type;

create index if not exists idx_team_access_tokens_team_type_role_active
  on public.team_access_tokens (team_id, token_type, granted_membership_role, is_active);

create unique index if not exists ux_team_access_tokens_one_active_type_role
  on public.team_access_tokens (team_id, token_type, granted_membership_role)
  where is_active = true;
