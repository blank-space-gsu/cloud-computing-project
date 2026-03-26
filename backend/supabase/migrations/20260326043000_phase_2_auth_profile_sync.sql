create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    first_name,
    last_name,
    job_title,
    app_role,
    is_active
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'User'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 'Account'),
    nullif(trim(new.raw_user_meta_data ->> 'job_title'), ''),
    coalesce((new.raw_app_meta_data ->> 'app_role')::public.app_role, 'employee'),
    true
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    job_title = excluded.job_title,
    app_role = excluded.app_role,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_profile_sync();
