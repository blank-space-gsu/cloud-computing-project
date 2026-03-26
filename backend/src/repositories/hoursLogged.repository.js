import { APP_ROLES } from "../constants/roles.js";
import { getPool } from "../db/pool.js";

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const mapHoursLogRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  userEmail: row.user_email,
  userFullName: `${row.user_first_name ?? ""} ${row.user_last_name ?? ""}`.trim(),
  teamId: row.team_id,
  teamName: row.team_name,
  taskId: row.task_id,
  taskTitle: row.task_title,
  workDate: row.work_date?.toISOString?.().slice(0, 10) ?? row.work_date,
  hours: Number(row.hours),
  note: row.note,
  createdByUserId: row.created_by_user_id,
  createdByFullName:
    `${row.created_by_first_name ?? ""} ${row.created_by_last_name ?? ""}`.trim(),
  updatedByUserId: row.updated_by_user_id,
  createdAt: normalizeTimestamp(row.created_at),
  updatedAt: normalizeTimestamp(row.updated_at)
});

const hoursSelectColumns = `
  hl.id,
  hl.user_id,
  entry_user.email as user_email,
  entry_user.first_name as user_first_name,
  entry_user.last_name as user_last_name,
  hl.team_id,
  team.name as team_name,
  hl.task_id,
  task.title as task_title,
  hl.work_date,
  hl.hours,
  hl.note,
  hl.created_by_user_id,
  creator.first_name as created_by_first_name,
  creator.last_name as created_by_last_name,
  hl.updated_by_user_id,
  hl.created_at,
  hl.updated_at
`;

const hoursFromClause = `
  from public.hours_logged hl
  inner join public.users entry_user
    on entry_user.id = hl.user_id
  inner join public.teams team
    on team.id = hl.team_id
  left join public.tasks task
    on task.id = hl.task_id
  inner join public.users creator
    on creator.id = hl.created_by_user_id
`;

const addHoursAccessScope = (
  { actorUserId, actorAppRole, manageableTeamIds = [] },
  values,
  whereClauses
) => {
  if (actorAppRole === APP_ROLES.ADMIN) {
    return;
  }

  if (actorAppRole === APP_ROLES.MANAGER) {
    if (manageableTeamIds.length === 0) {
      whereClauses.push("1 = 0");
      return;
    }

    values.push(manageableTeamIds);
    whereClauses.push(`hl.team_id = any($${values.length}::uuid[])`);
    return;
  }

  values.push(actorUserId);
  whereClauses.push(`hl.user_id = $${values.length}`);
};

const addHoursFilters = (filters, values, whereClauses) => {
  if (filters.teamId) {
    values.push(filters.teamId);
    whereClauses.push(`hl.team_id = $${values.length}`);
  }

  if (filters.taskId) {
    values.push(filters.taskId);
    whereClauses.push(`hl.task_id = $${values.length}`);
  }

  if (filters.userId) {
    values.push(filters.userId);
    whereClauses.push(`hl.user_id = $${values.length}`);
  }

  if (filters.dateFrom) {
    values.push(filters.dateFrom);
    whereClauses.push(`hl.work_date >= $${values.length}::date`);
  }

  if (filters.dateTo) {
    values.push(filters.dateTo);
    whereClauses.push(`hl.work_date <= $${values.length}::date`);
  }
};

const buildOrderClause = (sortBy, sortOrder) => {
  const direction = sortOrder === "asc" ? "asc" : "desc";

  switch (sortBy) {
    case "hours":
      return `hl.hours ${direction}, hl.work_date desc, hl.created_at desc`;
    case "createdAt":
      return `hl.created_at ${direction}, hl.work_date desc`;
    default:
      return `hl.work_date ${direction}, hl.created_at desc`;
  }
};

export const listHoursLogsForScope = async (
  { actorUserId, actorAppRole, manageableTeamIds = [], filters = {} },
  { pool = getPool() } = {}
) => {
  const values = [];
  const whereClauses = [];

  addHoursAccessScope({ actorUserId, actorAppRole, manageableTeamIds }, values, whereClauses);
  addHoursFilters(filters, values, whereClauses);

  const whereSql = whereClauses.length > 0 ? `where ${whereClauses.join(" and ")}` : "";

  const countResult = await pool.query(
    `
      select count(*) as total
      ${hoursFromClause}
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
        ${hoursSelectColumns}
      ${hoursFromClause}
      ${whereSql}
      order by ${buildOrderClause(filters.sortBy, filters.sortOrder)}
      limit $${listValues.length - 1}
      offset $${listValues.length}
    `,
    listValues
  );

  const summaryResult = await pool.query(
    `
      select
        count(*) as entry_count,
        coalesce(sum(hl.hours), 0) as total_hours,
        coalesce(
          sum(hl.hours) filter (
            where hl.work_date >= date_trunc('week', timezone('utc', now()))::date
          ),
          0
        ) as current_week_hours,
        coalesce(
          sum(hl.hours) filter (
            where hl.work_date >= date_trunc('month', timezone('utc', now()))::date
          ),
          0
        ) as current_month_hours
      ${hoursFromClause}
      ${whereSql}
    `,
    values
  );

  const chartResult = await pool.query(
    `
      select
        hl.work_date,
        coalesce(sum(hl.hours), 0) as total_hours
      ${hoursFromClause}
      ${whereSql}
      group by hl.work_date
      order by hl.work_date asc
    `,
    values
  );

  const summaryRow = summaryResult.rows[0] ?? {};

  return {
    hoursLogs: listResult.rows.map(mapHoursLogRow),
    total,
    summary: {
      entryCount: Number(summaryRow.entry_count ?? 0),
      totalHours: Number(summaryRow.total_hours ?? 0),
      currentWeekHours: Number(summaryRow.current_week_hours ?? 0),
      currentMonthHours: Number(summaryRow.current_month_hours ?? 0)
    },
    charts: {
      byDate: chartResult.rows.map((row) => ({
        workDate: row.work_date?.toISOString?.().slice(0, 10) ?? row.work_date,
        totalHours: Number(row.total_hours ?? 0)
      }))
    }
  };
};

export const findHoursLogByIdForScope = async (
  { hoursLogId, actorUserId, actorAppRole, manageableTeamIds = [] },
  { pool = getPool() } = {}
) => {
  const values = [hoursLogId];
  const whereClauses = ["hl.id = $1"];

  addHoursAccessScope({ actorUserId, actorAppRole, manageableTeamIds }, values, whereClauses);

  const result = await pool.query(
    `
      select
        ${hoursSelectColumns}
      ${hoursFromClause}
      where ${whereClauses.join(" and ")}
    `,
    values
  );

  return result.rows[0] ? mapHoursLogRow(result.rows[0]) : null;
};

export const createHoursLog = async (
  hoursLog,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.hours_logged (
        user_id,
        team_id,
        task_id,
        work_date,
        hours,
        note,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning id
    `,
    [
      hoursLog.userId,
      hoursLog.teamId,
      hoursLog.taskId ?? null,
      hoursLog.workDate,
      hoursLog.hours,
      hoursLog.note ?? null,
      hoursLog.createdByUserId,
      hoursLog.updatedByUserId ?? null
    ]
  );

  return result.rows[0]?.id ?? null;
};
