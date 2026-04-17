import {
  TEAM_ACCESS_TOKEN_TYPES,
  TEAM_MEMBERSHIP_STATUSES
} from "../constants/teamMemberships.js";
import { getPool } from "../db/pool.js";

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const mapTeamSummary = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  membershipRole: row.membership_role,
  membershipStatus: row.membership_status ?? null,
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
  isActive: row.is_active,
  membershipRole: row.membership_role,
  membershipStatus: row.membership_status,
  joinedAt: normalizeTimestamp(row.joined_at),
  leftAt: normalizeTimestamp(row.left_at),
  removedAt: normalizeTimestamp(row.removed_at),
  lastRejoinedAt: normalizeTimestamp(row.last_rejoined_at)
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
  membershipRole: row.membership_role,
  membershipStatus: row.membership_status,
  joinedAt: normalizeTimestamp(row.joined_at),
  leftAt: normalizeTimestamp(row.left_at),
  removedAt: normalizeTimestamp(row.removed_at),
  lastRejoinedAt: normalizeTimestamp(row.last_rejoined_at)
});

const mapTeamRecord = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: normalizeTimestamp(row.created_at),
  updatedAt: normalizeTimestamp(row.updated_at)
});

const mapMembershipRecord = (row) => ({
  teamId: row.team_id,
  userId: row.user_id,
  membershipRole: row.membership_role,
  membershipStatus: row.membership_status,
  joinedAt: normalizeTimestamp(row.joined_at),
  leftAt: normalizeTimestamp(row.left_at),
  removedAt: normalizeTimestamp(row.removed_at),
  lastRejoinedAt: normalizeTimestamp(row.last_rejoined_at),
  createdAt: normalizeTimestamp(row.created_at),
  updatedAt: normalizeTimestamp(row.updated_at)
});

const mapTeamAccessToken = (row) => ({
  id: row.id,
  teamId: row.team_id,
  tokenType: row.token_type,
  tokenValue: row.token_value,
  createdByUserId: row.created_by_user_id,
  expiresAt: normalizeTimestamp(row.expires_at),
  revokedAt: normalizeTimestamp(row.revoked_at),
  isActive: row.is_active,
  createdAt: normalizeTimestamp(row.created_at),
  updatedAt: normalizeTimestamp(row.updated_at)
});

const ACTIVE_MEMBERSHIP_STATUS = TEAM_MEMBERSHIP_STATUSES.ACTIVE;

const teamSummarySelect = `
  t.id,
  t.name,
  t.description,
  t.created_at,
  t.updated_at,
  viewer.membership_role,
  viewer.membership_status,
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
        and viewer.membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      left join public.team_members tm
        on tm.team_id = t.id
        and tm.membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      where ($2::boolean = true or viewer.user_id is not null)
      group by
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        viewer.membership_role,
        viewer.membership_status
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
        and viewer.membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      left join public.team_members tm
        on tm.team_id = t.id
        and tm.membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      where
        t.id = $1
        and ($3::boolean = true or viewer.user_id is not null)
      group by
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        viewer.membership_role,
        viewer.membership_status
    `,
    [teamId, requestingUserId, isAdmin]
  );

  return result.rows[0] ? mapTeamSummary(result.rows[0]) : null;
};

export const findTeamRecordById = async (
  teamId,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        id,
        name,
        description,
        created_at,
        updated_at
      from public.teams
      where id = $1
    `,
    [teamId]
  );

  return result.rows[0] ? mapTeamRecord(result.rows[0]) : null;
};

export const listMembersForAccessibleTeam = async (
  { teamId, membershipStatus = ACTIVE_MEMBERSHIP_STATUS },
  { pool = getPool() } = {}
) => {
  const values = [teamId];
  const statusClause = membershipStatus
    ? `and tm.membership_status = $2`
    : "";

  if (membershipStatus) {
    values.push(membershipStatus);
  }

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
        tm.membership_role,
        tm.membership_status,
        tm.joined_at,
        tm.left_at,
        tm.removed_at,
        tm.last_rejoined_at
      from public.team_members tm
      inner join public.users u
        on u.id = tm.user_id
      where tm.team_id = $1
        ${statusClause}
        and u.is_active = true
      order by
        case
          when tm.membership_role = 'manager' then 0
          else 1
        end,
        u.first_name asc,
        u.last_name asc
    `,
    values
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
        tm.membership_role,
        tm.membership_status,
        tm.joined_at,
        tm.left_at,
        tm.removed_at,
        tm.last_rejoined_at
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
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at
      )
      values ($1, $2, $3, '${ACTIVE_MEMBERSHIP_STATUS}', timezone('utc', now()), null, null, null)
      on conflict (team_id, user_id) do update
      set
        membership_role = excluded.membership_role,
        membership_status = excluded.membership_status,
        left_at = null,
        removed_at = null,
        last_rejoined_at = case
          when public.team_members.membership_status <> '${ACTIVE_MEMBERSHIP_STATUS}'
            then timezone('utc', now())
          else public.team_members.last_rejoined_at
        end,
        updated_at = timezone('utc', now())
      returning
        team_id,
        user_id,
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at,
        created_at,
        updated_at
    `,
    [membership.teamId, membership.userId, membership.membershipRole]
  );

  return result.rows[0] ? mapMembershipRecord(result.rows[0]) : null;
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
        membership_role,
        membership_status,
        joined_at
      )
      values ($1, $2, $3, '${ACTIVE_MEMBERSHIP_STATUS}', timezone('utc', now()))
      returning
        team_id,
        user_id,
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at,
        created_at,
        updated_at
    `,
    [membership.teamId, membership.userId, membership.membershipRole]
  );

  return result.rows[0] ? mapMembershipRecord(result.rows[0]) : null;
};

export const reactivateTeamMember = async (
  membership,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.team_members
      set
        membership_role = $3,
        membership_status = '${ACTIVE_MEMBERSHIP_STATUS}',
        left_at = null,
        removed_at = null,
        last_rejoined_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where team_id = $1
        and user_id = $2
      returning
        team_id,
        user_id,
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at,
        created_at,
        updated_at
    `,
    [membership.teamId, membership.userId, membership.membershipRole]
  );

  return result.rows[0] ? mapMembershipRecord(result.rows[0]) : null;
};

export const markTeamMemberLeft = async (
  { teamId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.team_members
      set
        membership_status = '${TEAM_MEMBERSHIP_STATUSES.LEFT}',
        left_at = timezone('utc', now()),
        removed_at = null,
        updated_at = timezone('utc', now())
      where team_id = $1
        and user_id = $2
        and membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      returning
        team_id,
        user_id,
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at,
        created_at,
        updated_at
    `,
    [teamId, userId]
  );

  return result.rows[0] ? mapMembershipRecord(result.rows[0]) : null;
};

export const markTeamMemberRemoved = async (
  { teamId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.team_members
      set
        membership_status = '${TEAM_MEMBERSHIP_STATUSES.REMOVED}',
        removed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where team_id = $1
        and user_id = $2
        and membership_status = '${ACTIVE_MEMBERSHIP_STATUS}'
      returning
        team_id,
        user_id,
        membership_role,
        membership_status,
        joined_at,
        left_at,
        removed_at,
        last_rejoined_at,
        created_at,
        updated_at
    `,
    [teamId, userId]
  );

  return result.rows[0] ? mapMembershipRecord(result.rows[0]) : null;
};

export const insertTeamMembershipEvent = async (
  event,
  { pool = getPool() } = {}
) => {
  await pool.query(
    `
      insert into public.team_membership_events (
        team_id,
        user_id,
        event_type,
        membership_role,
        acted_by_user_id,
        team_access_token_id,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      event.teamId,
      event.userId,
      event.eventType,
      event.membershipRole,
      event.actedByUserId ?? null,
      event.teamAccessTokenId ?? null,
      JSON.stringify(event.metadata ?? {})
    ]
  );
};

export const listActiveTeamAccessTokens = async (
  { teamId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        id,
        team_id,
        token_type,
        token_value,
        created_by_user_id,
        expires_at,
        revoked_at,
        is_active,
        created_at,
        updated_at
      from public.team_access_tokens
      where team_id = $1
        and is_active = true
        and revoked_at is null
        and (expires_at is null or expires_at > timezone('utc', now()))
      order by
        case
          when token_type = '${TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE}' then 0
          else 1
        end,
        created_at desc
    `,
    [teamId]
  );

  return result.rows.map(mapTeamAccessToken);
};

export const createTeamAccessToken = async (
  accessToken,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.team_access_tokens (
        team_id,
        token_type,
        token_value,
        created_by_user_id,
        expires_at
      )
      values ($1, $2, $3, $4, $5)
      returning
        id,
        team_id,
        token_type,
        token_value,
        created_by_user_id,
        expires_at,
        revoked_at,
        is_active,
        created_at,
        updated_at
    `,
    [
      accessToken.teamId,
      accessToken.tokenType,
      accessToken.tokenValue,
      accessToken.createdByUserId,
      accessToken.expiresAt ?? null
    ]
  );

  return result.rows[0] ? mapTeamAccessToken(result.rows[0]) : null;
};

export const revokeActiveTeamAccessTokens = async (
  { teamId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.team_access_tokens
      set
        is_active = false,
        revoked_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where team_id = $1
        and is_active = true
      returning id
    `,
    [teamId]
  );

  return result.rowCount;
};

export const findTeamAccessTokenByValue = async (
  { tokenType, tokenValue },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        id,
        team_id,
        token_type,
        token_value,
        created_by_user_id,
        expires_at,
        revoked_at,
        is_active,
        created_at,
        updated_at
      from public.team_access_tokens
      where token_type = $1
        and token_value = $2
      limit 1
    `,
    [tokenType, tokenValue]
  );

  return result.rows[0] ? mapTeamAccessToken(result.rows[0]) : null;
};
