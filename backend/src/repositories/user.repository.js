import { getPool } from "../db/pool.js";

const mapAccessProfile = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  jobTitle: row.job_title,
  appRole: row.app_role,
  isActive: row.is_active,
  teams: row.teams ?? []
});

export const findUserAccessProfileById = async (
  userId,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.job_title,
        u.app_role,
        u.is_active,
        coalesce(
          json_agg(
            distinct jsonb_build_object(
              'teamId', t.id,
              'teamName', t.name,
              'membershipRole', tm.membership_role
            )
          ) filter (where t.id is not null),
          '[]'::json
        ) as teams
      from public.users u
      left join public.team_members tm
        on tm.user_id = u.id
      left join public.teams t
        on t.id = tm.team_id
      where u.id = $1
      group by
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.job_title,
        u.app_role,
        u.is_active
    `,
    [userId]
  );

  return result.rows[0] ? mapAccessProfile(result.rows[0]) : null;
};

export const upsertUserProfile = async (
  profile,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.users (
        id,
        email,
        first_name,
        last_name,
        job_title,
        app_role,
        is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (id) do update
      set
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        job_title = excluded.job_title,
        app_role = excluded.app_role,
        is_active = excluded.is_active,
        updated_at = timezone('utc', now())
      returning
        id,
        email,
        first_name,
        last_name,
        job_title,
        app_role,
        is_active
    `,
    [
      profile.id,
      profile.email,
      profile.firstName,
      profile.lastName,
      profile.jobTitle,
      profile.appRole,
      profile.isActive ?? true
    ]
  );

  return mapAccessProfile({
    ...result.rows[0],
    teams: []
  });
};
