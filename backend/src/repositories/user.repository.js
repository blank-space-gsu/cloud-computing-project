import { getPool } from "../db/pool.js";
import { TEAM_MEMBERSHIP_STATUSES } from "../constants/teamMemberships.js";

const normalizeDate = (value) => value?.toISOString?.().slice(0, 10) ?? value ?? null;

const mapAccessProfile = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  jobTitle: row.job_title,
  dateOfBirth: normalizeDate(row.date_of_birth),
  address: row.address,
  avatarUrl: row.avatar_url,
  appRole: row.app_role,
  isActive: row.is_active,
  teams: row.teams ?? []
});

const userSelectColumns = `
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.job_title,
  u.date_of_birth,
  u.address,
  u.avatar_url,
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
`;

export const findUserAccessProfileById = async (
  userId,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        ${userSelectColumns}
      from public.users u
      left join public.team_members tm
        on tm.user_id = u.id
        and tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
      left join public.teams t
        on t.id = tm.team_id
      where u.id = $1
      group by
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.job_title,
        u.date_of_birth,
        u.address,
        u.avatar_url,
        u.app_role,
        u.is_active
    `,
    [userId]
  );

  return result.rows[0] ? mapAccessProfile(result.rows[0]) : null;
};

export const findUserAccessProfileByEmail = async (
  email,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        ${userSelectColumns}
      from public.users u
      left join public.team_members tm
        on tm.user_id = u.id
        and tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
      left join public.teams t
        on t.id = tm.team_id
      where lower(u.email) = lower($1)
      group by
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.job_title,
        u.date_of_birth,
        u.address,
        u.avatar_url,
        u.app_role,
        u.is_active
    `,
    [email]
  );

  return result.rows[0] ? mapAccessProfile(result.rows[0]) : null;
};

export const listUsersForDirectory = async (
  { role, teamId, includeInactive = false, search },
  { pool = getPool() } = {}
) => {
  const values = [];
  const whereClauses = [];

  if (role) {
    values.push(role);
    whereClauses.push(`u.app_role::text = $${values.length}`);
  }

  if (teamId) {
    values.push(teamId);
    whereClauses.push(`
      exists (
        select 1
        from public.team_members scoped_tm
        where scoped_tm.user_id = u.id
          and scoped_tm.team_id = $${values.length}
          and scoped_tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
      )
    `);
  }

  if (!includeInactive) {
    whereClauses.push(`u.is_active = true`);
  }

  if (search) {
    values.push(`%${search}%`);
    whereClauses.push(`
      (
        u.first_name ilike $${values.length}
        or u.last_name ilike $${values.length}
        or u.email ilike $${values.length}
        or coalesce(u.job_title, '') ilike $${values.length}
      )
    `);
  }

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const result = await pool.query(
    `
      select
        ${userSelectColumns}
      from public.users u
      left join public.team_members tm
        on tm.user_id = u.id
        and tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
      left join public.teams t
        on t.id = tm.team_id
      ${whereSql}
      group by
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.job_title,
        u.date_of_birth,
        u.address,
        u.avatar_url,
        u.app_role,
        u.is_active
      order by u.first_name asc, u.last_name asc, u.email asc
    `,
    values
  );

  return result.rows.map(mapAccessProfile);
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
        date_of_birth,
        address,
        avatar_url,
        app_role,
        is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (id) do update
      set
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        job_title = excluded.job_title,
        date_of_birth = excluded.date_of_birth,
        address = excluded.address,
        avatar_url = excluded.avatar_url,
        app_role = excluded.app_role,
        is_active = excluded.is_active,
        updated_at = timezone('utc', now())
      returning
        id,
        email,
        first_name,
        last_name,
        job_title,
        date_of_birth,
        address,
        avatar_url,
        app_role,
        is_active
    `,
    [
      profile.id,
      profile.email,
      profile.firstName,
      profile.lastName,
      profile.jobTitle,
      profile.dateOfBirth ?? null,
      profile.address ?? null,
      profile.avatarUrl ?? null,
      profile.appRole,
      profile.isActive ?? true
    ]
  );

  return mapAccessProfile({
    ...result.rows[0],
    teams: []
  });
};

export const syncAuthBackedUserProfile = async (
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
        date_of_birth,
        address,
        avatar_url,
        app_role,
        is_active
    `,
    [
      profile.id,
      profile.email,
      profile.firstName,
      profile.lastName,
      profile.jobTitle ?? null,
      profile.appRole,
      profile.isActive ?? true
    ]
  );

  return mapAccessProfile({
    ...result.rows[0],
    teams: []
  });
};

export const updateUserProfileById = async (
  userId,
  patch,
  { pool = getPool() } = {}
) => {
  const columnMap = {
    firstName: "first_name",
    lastName: "last_name",
    jobTitle: "job_title",
    dateOfBirth: "date_of_birth",
    address: "address",
    avatarUrl: "avatar_url",
    appRole: "app_role",
    isActive: "is_active"
  };

  const values = [];
  const setClauses = [];

  for (const [field, column] of Object.entries(columnMap)) {
    if (!Object.hasOwn(patch, field)) {
      continue;
    }

    values.push(patch[field]);
    setClauses.push(`${column} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return findUserAccessProfileById(userId, { pool });
  }

  values.push(userId);

  const result = await pool.query(
    `
      update public.users
      set
        ${setClauses.join(", ")},
        updated_at = timezone('utc', now())
      where id = $${values.length}
      returning id
    `,
    values
  );

  return result.rows[0]
    ? findUserAccessProfileById(userId, { pool })
    : null;
};
