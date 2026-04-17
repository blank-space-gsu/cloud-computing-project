import { APP_ROLES } from "../constants/roles.js";
import { TASK_STATUSES } from "../constants/tasks.js";
import { TEAM_MEMBERSHIP_STATUSES } from "../constants/teamMemberships.js";
import { getPool } from "../db/pool.js";

const CLOSED_TASK_STATUSES = new Set([
  TASK_STATUSES.COMPLETED,
  TASK_STATUSES.CANCELLED
]);

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const mapTaskRow = (row) => {
  const dueAt = normalizeTimestamp(row.due_at);
  const dueAtMs = dueAt ? Date.parse(dueAt) : null;
  const now = Date.now();
  const isClosed = CLOSED_TASK_STATUSES.has(row.status);

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
    weekStartDate: row.week_start_date?.toISOString?.().slice(0, 10) ?? row.week_start_date,
    recurringRuleId: row.recurring_rule_id ?? null,
    generatedForDate:
      row.generated_for_date?.toISOString?.().slice(0, 10)
      ?? row.generated_for_date
      ?? null,
    estimatedHours:
      row.estimated_hours === null || row.estimated_hours === undefined
        ? null
        : Number(row.estimated_hours),
    progressPercent: Number(row.progress_percent),
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
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
          assigneeEmail: row.assignee_email,
          assigneeFullName:
            `${row.assignee_first_name ?? ""} ${row.assignee_last_name ?? ""}`.trim(),
          assignedByUserId: row.assigned_by_user_id,
          assignmentNote: row.assignment_note,
          assignedAt: normalizeTimestamp(row.assigned_at)
        }
      : null
  };
};

const mapAssignableUser = (row) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  appRole: row.app_role,
  isActive: row.is_active,
  membershipRole: row.membership_role
});

const taskSelectColumns = `
  t.id,
  t.team_id,
  team.name as team_name,
  t.title,
  t.description,
  t.notes,
  t.status,
  t.priority,
  t.due_at,
  t.week_start_date,
  t.recurring_rule_id,
  t.generated_for_date,
  t.estimated_hours,
  t.progress_percent,
  t.created_by_user_id,
  t.updated_by_user_id,
  t.completed_at,
  t.created_at,
  t.updated_at,
  active_assignment.id as active_assignment_id,
  active_assignment.assignee_user_id,
  active_assignment.assigned_by_user_id,
  active_assignment.assignment_note,
  active_assignment.assigned_at,
  assignee.email as assignee_email,
  assignee.first_name as assignee_first_name,
  assignee.last_name as assignee_last_name
`;

const taskFromClause = `
  from public.tasks t
  inner join public.teams team
    on team.id = t.team_id
  left join public.task_assignments active_assignment
    on active_assignment.task_id = t.id
    and active_assignment.is_active = true
  left join public.users assignee
    on assignee.id = active_assignment.assignee_user_id
`;

const addAccessScope = ({ actorUserId, actorAppRole }, values, whereClauses) => {
  if (actorAppRole === APP_ROLES.ADMIN) {
    return;
  }

  values.push(actorUserId);

  if (actorAppRole === APP_ROLES.MANAGER) {
    whereClauses.push(`
      exists (
        select 1
        from public.team_members viewer_tm
        where viewer_tm.team_id = t.team_id
          and viewer_tm.user_id = $${values.length}
          and viewer_tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
          and viewer_tm.membership_role = 'manager'
      )
    `);
    return;
  }

  whereClauses.push(`active_assignment.assignee_user_id = $${values.length}`);
};

const addListFilters = (filters, values, whereClauses) => {
  if (filters.teamId) {
    values.push(filters.teamId);
    whereClauses.push(`t.team_id = $${values.length}`);
  }

  if (filters.assigneeUserId) {
    values.push(filters.assigneeUserId);
    whereClauses.push(`active_assignment.assignee_user_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    whereClauses.push(`t.status = $${values.length}`);
  }

  if (filters.priority) {
    values.push(filters.priority);
    whereClauses.push(`t.priority = $${values.length}`);
  }

  if (filters.weekStartDate) {
    values.push(filters.weekStartDate);
    whereClauses.push(`t.week_start_date = $${values.length}::date`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    whereClauses.push(`t.due_at >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    whereClauses.push(`t.due_at < ($${values.length}::date + interval '1 day')`);
  }

  if (filters.includeCompleted === false) {
    whereClauses.push(`t.status not in ('completed', 'cancelled')`);
  }
};

const buildOrderClause = (sortBy, sortOrder) => {
  const direction = sortOrder === "desc" ? "desc" : "asc";
  const priorityRank = `
    case t.priority
      when 'urgent' then 4
      when 'high' then 3
      when 'medium' then 2
      else 1
    end
  `;
  const urgencyRank = `
    case
      when t.status in ('completed', 'cancelled') then 5
      when t.due_at is null then 4
      when t.due_at < timezone('utc', now()) then 0
      when t.due_at <= timezone('utc', now()) + interval '1 day' then 1
      when t.priority = 'urgent' then 2
      when t.due_at <= timezone('utc', now()) + interval '3 days' then 3
      else 4
    end
  `;

  switch (sortBy) {
    case "dueAt":
      return `t.due_at ${direction} nulls last, ${priorityRank} desc, t.created_at desc`;
    case "priority":
      return `${priorityRank} ${direction}, t.due_at asc nulls last, t.created_at desc`;
    case "createdAt":
      return `t.created_at ${direction}, t.due_at asc nulls last`;
    case "weekStartDate":
      return `t.week_start_date ${direction}, t.due_at asc nulls last, ${priorityRank} desc`;
    default:
      return `${urgencyRank} ${direction}, t.due_at asc nulls last, ${priorityRank} desc, t.created_at desc`;
  }
};

export const listAccessibleTasks = async (
  { actorUserId, actorAppRole, filters = {} },
  { pool = getPool() } = {}
) => {
  const values = [];
  const whereClauses = [];

  addAccessScope({ actorUserId, actorAppRole }, values, whereClauses);
  addListFilters(filters, values, whereClauses);

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const countResult = await pool.query(
    `
      select count(*) as total
      ${taskFromClause}
      ${whereSql}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.total ?? 0);
  const limit = filters.limit ?? 50;
  const page = filters.page ?? 1;
  const offset = (page - 1) * limit;

  const listValues = [...values, limit, offset];
  const listResult = await pool.query(
    `
      select
        ${taskSelectColumns}
      ${taskFromClause}
      ${whereSql}
      order by ${buildOrderClause(filters.sortBy, filters.sortOrder)}
      limit $${listValues.length - 1}
      offset $${listValues.length}
    `,
    listValues
  );

  return {
    tasks: listResult.rows.map(mapTaskRow),
    total
  };
};

export const findTaskByIdForActor = async (
  { taskId, actorUserId, actorAppRole },
  { pool = getPool() } = {}
) => {
  const values = [taskId];
  const whereClauses = ["t.id = $1"];

  addAccessScope({ actorUserId, actorAppRole }, values, whereClauses);

  const result = await pool.query(
    `
      select
        ${taskSelectColumns}
      ${taskFromClause}
      where ${whereClauses.join(" and ")}
    `,
    values
  );

  return result.rows[0] ? mapTaskRow(result.rows[0]) : null;
};

export const createTask = async (
  task,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.tasks (
        team_id,
        title,
        description,
        notes,
        status,
        priority,
        due_at,
        week_start_date,
        recurring_rule_id,
        generated_for_date,
        estimated_hours,
        progress_percent,
        created_by_user_id,
        updated_by_user_id,
        completed_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      returning id
    `,
    [
      task.teamId,
      task.title,
      task.description ?? null,
      task.notes ?? null,
      task.status,
      task.priority,
      task.dueAt ?? null,
      task.weekStartDate,
      task.recurringRuleId ?? null,
      task.generatedForDate ?? null,
      task.estimatedHours ?? null,
      task.progressPercent,
      task.createdByUserId,
      task.updatedByUserId ?? null,
      task.completedAt ?? null
    ]
  );

  return result.rows[0]?.id ?? null;
};

export const updateTaskById = async (
  taskId,
  patch,
  { pool = getPool() } = {}
) => {
  const columnMap = {
    title: "title",
    description: "description",
    notes: "notes",
    status: "status",
    priority: "priority",
    dueAt: "due_at",
    weekStartDate: "week_start_date",
    estimatedHours: "estimated_hours",
    progressPercent: "progress_percent",
    updatedByUserId: "updated_by_user_id",
    completedAt: "completed_at"
  };

  const setClauses = [];
  const values = [];

  for (const [field, column] of Object.entries(columnMap)) {
    if (!Object.hasOwn(patch, field)) {
      continue;
    }

    values.push(patch[field]);
    setClauses.push(`${column} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return taskId;
  }

  values.push(taskId);

  await pool.query(
    `
      update public.tasks
      set ${setClauses.join(", ")}
      where id = $${values.length}
    `,
    values
  );

  return taskId;
};

export const deleteTaskById = async (
  taskId,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      delete from public.tasks
      where id = $1
      returning id
    `,
    [taskId]
  );

  return result.rows[0]?.id ?? null;
};

export const findAssignableUserInTeam = async (
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
        u.app_role,
        u.is_active,
        tm.membership_role
      from public.users u
      inner join public.team_members tm
        on tm.user_id = u.id
      where tm.team_id = $1
        and u.id = $2
        and tm.membership_status = '${TEAM_MEMBERSHIP_STATUSES.ACTIVE}'
    `,
    [teamId, userId]
  );

  return result.rows[0] ? mapAssignableUser(result.rows[0]) : null;
};

export const countOpenActiveAssignmentsForAssigneeInTeam = async (
  { teamId, userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select count(*) as open_assignment_count
      from public.task_assignments ta
      inner join public.tasks t
        on t.id = ta.task_id
      where ta.assignee_user_id = $1
        and ta.is_active = true
        and t.team_id = $2
        and t.status not in ('completed', 'cancelled')
    `,
    [userId, teamId]
  );

  return Number(result.rows[0]?.open_assignment_count ?? 0);
};

export const deactivateActiveTaskAssignment = async (
  { taskId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      update public.task_assignments
      set
        is_active = false,
        unassigned_at = timezone('utc', now())
      where task_id = $1
        and is_active = true
      returning id
    `,
    [taskId]
  );

  return result.rowCount;
};

export const createTaskAssignment = async (
  assignment,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.task_assignments (
        task_id,
        assignee_user_id,
        assigned_by_user_id,
        assignment_note
      )
      values ($1, $2, $3, $4)
      returning id
    `,
    [
      assignment.taskId,
      assignment.assigneeUserId,
      assignment.assignedByUserId,
      assignment.assignmentNote ?? null
    ]
  );

  return result.rows[0]?.id ?? null;
};

export const createTaskUpdate = async (
  update,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.task_updates (
        task_id,
        updated_by_user_id,
        update_type,
        status_after,
        progress_percent_after,
        note,
        assignee_user_id,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, timezone('utc', now())))
      returning id
    `,
    [
      update.taskId,
      update.updatedByUserId,
      update.updateType,
      update.statusAfter ?? null,
      update.progressPercentAfter ?? null,
      update.note ?? null,
      update.assigneeUserId ?? null,
      update.createdAt ?? null
    ]
  );

  return result.rows[0]?.id ?? null;
};

export const listDueNotificationCandidatesForUser = async (
  { userId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.status,
        t.due_at
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      inner join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      where active_assignment.assignee_user_id = $1
        and t.due_at is not null
        and t.status not in ('completed', 'cancelled')
        and t.due_at <= timezone('utc', now()) + interval '48 hours'
      order by t.due_at asc
    `,
    [userId]
  );

  return result.rows.map((row) => {
    const dueAt = normalizeTimestamp(row.due_at);
    const dueAtMs = dueAt ? Date.parse(dueAt) : null;
    const now = Date.now();

    return {
      id: row.id,
      teamId: row.team_id,
      teamName: row.team_name,
      title: row.title,
      status: row.status,
      dueAt,
      isOverdue: dueAtMs !== null && dueAtMs < now
    };
  });
};
