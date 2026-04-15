import { getPool } from "../db/pool.js";

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const mapTeamSummary = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  membershipRole: row.membership_role,
  memberCount: Number(row.member_count ?? 0),
  managerCount: Number(row.manager_count ?? 0),
  createdAt: normalizeTimestamp(row.created_at),
  updatedAt: normalizeTimestamp(row.updated_at)
});

const mapTeamMember = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  jobTitle: row.job_title,
  avatarUrl: row.avatar_url,
  appRole: row.app_role,
  membershipRole: row.membership_role,
  isActive: row.is_active
});

const mapTeamMemberUser = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  jobTitle: row.job_title,
  avatarUrl: row.avatar_url,
  appRole: row.app_role,
  isActive: row.is_active,
  membershipRole: row.membership_role
});

const teamSummarySelect = `
  t.id,
  t.name,
  t.description,
  t.created_at,
  t.updated_at,
  viewer.membership_role,
  count(distinct tm.user_id) as member_count,
  count(
    distinct case
      when tm.membership_role = 'manager' then tm.user_id
      else null
    end
  ) as manager_count
`;

export const upsertTeam = async (
  team,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.teams (
        name,
        description
      )
      values ($1, $2)
      on conflict (name) do update
      set
        description = excluded.description,
        updated_at = timezone('utc', now())
      returning
        id,
        name,
        description
    `,
    [team.name, team.description ?? null]
  );

  return result.rows[0];
};

export const listAccessibleTeams = async (
  { requestingUserId, isAdmin = false },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        ${teamSummarySelect}
      from public.teams t
      left join public.team_members viewer
        on viewer.team_id = t.id
        and viewer.user_id = $1
      left join public.team_members tm
        on tm.team_id = t.id
      where ($2::boolean = true or viewer.user_id is not null)
      group by
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        viewer.membership_role
      order by t.name asc
    `,
    [requestingUserId, isAdmin]
  );

  return result.rows.map(mapTeamSummary);
};

export const findAccessibleTeamById = async (
  { teamId, requestingUserId, isAdmin = false },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        ${teamSummarySelect}
      from public.teams t
      left join public.team_members viewer
        on viewer.team_id = t.id
        and viewer.user_id = $2
      left join public.team_members tm
        on tm.team_id = t.id
      where
        t.id = $1
        and ($3::boolean = true or viewer.user_id is not null)
      group by
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        viewer.membership_role
    `,
    [teamId, requestingUserId, isAdmin]
  );

  return result.rows[0] ? mapTeamSummary(result.rows[0]) : null;
};

export const listMembersForAccessibleTeam = async (
  { teamId },
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
        u.avatar_url,
        u.app_role,
        u.is_active,
        tm.membership_role
      from public.team_members tm
      inner join public.users u
        on u.id = tm.user_id
      where tm.team_id = $1
        and u.is_active = true
      order by
        case
          when tm.membership_role = 'manager' then 0
          else 1
        end,
        u.first_name asc,
        u.last_name asc
    `,
    [teamId]
  );

  return result.rows.map(mapTeamMember);
};

export const findTeamMemberUserById = async (
  { teamId, userId },
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
        u.avatar_url,
        u.app_role,
        u.is_active,
        tm.membership_role
      from public.team_members tm
      inner join public.users u
        on u.id = tm.user_id
      where tm.team_id = $1
        and u.id = $2
    `,
    [teamId, userId]
  );

  return result.rows[0] ? mapTeamMemberUser(result.rows[0]) : null;
};

export const upsertTeamMember = async (
  membership,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.team_members (
        team_id,
        user_id,
        membership_role
      )
      values ($1, $2, $3)
      on conflict (team_id, user_id) do update
      set
        membership_role = excluded.membership_role,
        updated_at = timezone('utc', now())
      returning
        team_id,
        user_id,
        membership_role
    `,
    [membership.teamId, membership.userId, membership.membershipRole]
  );

  return result.rows[0];
};

export const createTeamRecord = async (
  team,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.teams (
        name,
        description
      )
      values ($1, $2)
      returning id
    `,
    [team.name, team.description ?? null]
  );

  return result.rows[0]?.id ?? null;
};

export const updateTeamById = async (
  teamId,
  patch,
  { pool = getPool() } = {}
) => {
  const columnMap = {
    name: "name",
    description: "description"
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
    return teamId;
  }

  values.push(teamId);

  const result = await pool.query(
    `
      update public.teams
      set
        ${setClauses.join(", ")},
        updated_at = timezone('utc', now())
      where id = $${values.length}
      returning id
    `,
    values
  );

  return result.rows[0]?.id ?? null;
};

export const createTeamMember = async (
  membership,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.team_members (
        team_id,
        user_id,
        membership_role
      )
      values ($1, $2, $3)
      returning
        team_id,
        user_id,
        membership_role
    `,
    [membership.teamId, membership.userId, membership.membershipRole]
  );

  return result.rows[0] ?? null;
};

export const deleteTeamMemberById = async (
  { teamId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      delete from public.team_members
      where team_id = $1
        and user_id = $2
      returning
        team_id,
        user_id,
        membership_role
    `,
    [teamId, userId]
  );

  return result.rows[0] ?? null;
};
