import { TASK_STATUSES } from "../constants/tasks.js";
import { TEAM_MEMBERSHIP_STATUSES } from "../constants/teamMemberships.js";
import { getPool } from "../db/pool.js";

const CLOSED_TASK_STATUSES_SQL = `('completed', 'cancelled')`;

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const buildUrgencyOrderClause = () => `
  case
    when t.status in ('completed', 'cancelled') then 5
    when t.due_at is null then 4
    when t.due_at < timezone('utc', now()) then 0
    when t.due_at <= timezone('utc', now()) + interval '1 day' then 1
    when t.priority = 'urgent' then 2
    when t.due_at <= timezone('utc', now()) + interval '3 days' then 3
    else 4
  end asc,
  t.due_at asc nulls last,
  case t.priority
    when 'urgent' then 4
    when 'high' then 3
    when 'medium' then 2
    else 1
  end desc,
  t.created_at desc
`;

const mapTeamSummary = (row) => {
  const totalTaskCount = Number(row.total_task_count ?? 0);
  const completedTaskCount = Number(row.completed_task_count ?? 0);

  return {
    teamId: row.team_id,
    teamName: row.team_name,
    teamDescription: row.team_description,
    completionPercent:
      totalTaskCount === 0
        ? 0
        : Number(((completedTaskCount / totalTaskCount) * 100).toFixed(2)),
    totalTaskCount,
    openTaskCount: Number(row.open_task_count ?? 0),
    completedTaskCount,
    overdueTaskCount: Number(row.overdue_task_count ?? 0),
    blockedTaskCount: Number(row.blocked_task_count ?? 0),
    unassignedTaskCount: Number(row.unassigned_task_count ?? 0)
  };
};

const mapMemberRow = (row) => {
  const totalTaskCount = Number(row.total_task_count ?? 0);
  const completedTaskCount = Number(row.completed_task_count ?? 0);

  return {
    userId: row.user_id,
    fullName: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
    firstName: row.first_name,
    lastName: row.last_name,
    jobTitle: row.job_title,
    completionPercent:
      totalTaskCount === 0
        ? 0
        : Number(((completedTaskCount / totalTaskCount) * 100).toFixed(2)),
    totalTaskCount,
    completedTaskCount,
    openTaskCount: Number(row.open_task_count ?? 0),
    overdueTaskCount: Number(row.overdue_task_count ?? 0),
    blockedTaskCount: Number(row.blocked_task_count ?? 0)
  };
};

const mapTaskRow = (row) => {
  const dueAt = normalizeTimestamp(row.due_at);
  const dueAtMs = dueAt ? Date.parse(dueAt) : null;
  const now = Date.now();
  const isClosed =
    row.status === TASK_STATUSES.COMPLETED || row.status === TASK_STATUSES.CANCELLED;

  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    title: row.title,
    description: row.description,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    dueAt,
    progressPercent: Number(row.progress_percent ?? 0),
    completedAt: normalizeTimestamp(row.completed_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    timeRemainingSeconds:
      dueAtMs === null ? null : Math.floor((dueAtMs - now) / 1000),
    isOverdue: !isClosed && dueAtMs !== null && dueAtMs < now,
    isDueSoon:
      !isClosed &&
      dueAtMs !== null &&
      dueAtMs >= now &&
      dueAtMs <= now + (48 * 60 * 60 * 1000),
    assignment: row.active_assignment_id
      ? {
          id: row.active_assignment_id,
          assigneeUserId: row.assignee_user_id,
          assigneeFullName:
            `${row.assignee_first_name ?? ""} ${row.assignee_last_name ?? ""}`.trim(),
          assignedAt: normalizeTimestamp(row.assigned_at)
        }
      : null,
    latestUpdate: row.latest_update_created_at
      ? {
          updateType: row.latest_update_type,
          note: row.latest_update_note ?? null,
          createdAt: normalizeTimestamp(row.latest_update_created_at)
        }
      : null
  };
};

export const getWorkerTrackerTeamSummary = async (
  { teamId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        team.id as team_id,
        team.name as team_name,
        team.description as team_description,
        count(t.id) filter (where t.status <> 'cancelled') as total_task_count,
        count(t.id) filter (where t.status = 'completed') as completed_task_count,
        count(t.id) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
        count(t.id) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        count(t.id) filter (where t.status = 'blocked') as blocked_task_count,
        count(t.id) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and active_assignment.id is null
        ) as unassigned_task_count
      from public.teams team
      left join public.tasks t
        on t.team_id = team.id
      left join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      where team.id = $1
      group by team.id, team.name, team.description
    `,
    [teamId]
  );

  return result.rows[0] ? mapTeamSummary(result.rows[0]) : null;
};

export const listWorkerTrackerMembers = async (
  { teamId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.job_title,
        count(t.id) filter (where t.status <> 'cancelled') as total_task_count,
        count(t.id) filter (where t.status = 'completed') as completed_task_count,
        count(t.id) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
        count(t.id) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        count(t.id) filter (where t.status = 'blocked') as blocked_task_count
      from public.team_members tm
      inner join public.users u
        on u.id = tm.user_id
      left join public.task_assignments active_assignment
        on active_assignment.assignee_user_id = u.id
        and active_assignment.is_active = true
      left join public.tasks t
        on t.id = active_assignment.task_id
        and t.team_id = $1
      where tm.team_id = $1
        and tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
        and tm.membership_role = 'member'
        and u.is_active = true
      group by u.id, u.first_name, u.last_name, u.job_title
      order by
        count(t.id) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) desc,
        count(t.id) filter (where t.status = 'blocked') desc,
        count(t.id) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) desc,
        lower(u.last_name) asc,
        lower(u.first_name) asc
    `,
    [teamId]
  );

  return result.rows.map(mapMemberRow);
};

export const listWorkerTrackerTasksForMember = async (
  { teamId, memberUserId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.description,
        t.notes,
        t.status,
        t.priority,
        t.due_at,
        t.progress_percent,
        t.completed_at,
        t.created_at,
        t.updated_at,
        active_assignment.id as active_assignment_id,
        active_assignment.assignee_user_id,
        active_assignment.assigned_at,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        latest_update.update_type as latest_update_type,
        latest_update.note as latest_update_note,
        latest_update.created_at as latest_update_created_at
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      inner join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      left join public.users assignee
        on assignee.id = active_assignment.assignee_user_id
      left join lateral (
        select
          tu.update_type,
          tu.note,
          tu.created_at
        from public.task_updates tu
        where tu.task_id = t.id
        order by tu.created_at desc
        limit 1
      ) latest_update
        on true
      where t.team_id = $1
        and active_assignment.assignee_user_id = $2
      order by ${buildUrgencyOrderClause()}
    `,
    [teamId, memberUserId]
  );

  return result.rows.map(mapTaskRow);
};

export const listWorkerTrackerUnassignedTasks = async (
  { teamId, limit = 5 },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.description,
        t.notes,
        t.status,
        t.priority,
        t.due_at,
        t.progress_percent,
        t.completed_at,
        t.created_at,
        t.updated_at,
        latest_update.update_type as latest_update_type,
        latest_update.note as latest_update_note,
        latest_update.created_at as latest_update_created_at
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      left join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      left join lateral (
        select
          tu.update_type,
          tu.note,
          tu.created_at
        from public.task_updates tu
        where tu.task_id = t.id
        order by tu.created_at desc
        limit 1
      ) latest_update
        on true
      where t.team_id = $1
        and active_assignment.id is null
        and t.status not in ${CLOSED_TASK_STATUSES_SQL}
      order by ${buildUrgencyOrderClause()}
      limit $2
    `,
    [teamId, limit]
  );

  return result.rows.map(mapTaskRow);
};
