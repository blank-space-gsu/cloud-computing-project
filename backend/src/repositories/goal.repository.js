import {
  GOAL_PERIOD_VALUES,
  GOAL_SCOPE_VALUES,
  GOAL_STATUS_VALUES,
  GOAL_TYPE_VALUES
} from "../constants/goals.js";
import { getPool } from "../db/pool.js";
import { buildGoalProgress } from "../utils/goalProgress.js";
import {
  buildGoalSummary,
  createEmptyGoalSummary
} from "../utils/goalSummary.js";

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const fillCountSeries = (rows, keyName, expectedKeys) =>
  expectedKeys.map((key) => {
    const match = rows.find((row) => row[keyName] === key);

    return {
      [keyName]: key,
      count: Number(match?.count ?? 0)
    };
  });

const mapGoalRow = (row) => {
  const targetValue = Number(row.target_value);
  const actualValue = Number(row.actual_value);
  const progress = buildGoalProgress(targetValue, actualValue);

  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    targetUser: row.target_user_id
      ? {
          id: row.target_user_id,
          email: row.target_user_email,
          fullName:
            `${row.target_user_first_name ?? ""} ${row.target_user_last_name ?? ""}`.trim(),
          jobTitle: row.target_user_job_title
        }
      : null,
    title: row.title,
    description: row.description,
    goalType: row.goal_type,
    scope: row.scope,
    period: row.period,
    startDate: row.start_date?.toISOString?.().slice(0, 10) ?? row.start_date,
    endDate: row.end_date?.toISOString?.().slice(0, 10) ?? row.end_date,
    targetValue,
    actualValue,
    unit: row.unit,
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdByFullName:
      `${row.created_by_first_name ?? ""} ${row.created_by_last_name ?? ""}`.trim(),
    updatedByUserId: row.updated_by_user_id,
    updatedByFullName:
      row.updated_by_user_id
        ? `${row.updated_by_first_name ?? ""} ${row.updated_by_last_name ?? ""}`.trim()
        : null,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    ...progress
  };
};

const goalSelectColumns = `
  g.id,
  g.team_id,
  team.name as team_name,
  g.target_user_id,
  target_user.email as target_user_email,
  target_user.first_name as target_user_first_name,
  target_user.last_name as target_user_last_name,
  target_user.job_title as target_user_job_title,
  g.title,
  g.description,
  g.goal_type,
  g.scope,
  g.period,
  g.start_date,
  g.end_date,
  g.target_value,
  g.actual_value,
  g.unit,
  g.status,
  g.created_by_user_id,
  creator.first_name as created_by_first_name,
  creator.last_name as created_by_last_name,
  g.updated_by_user_id,
  updater.first_name as updated_by_first_name,
  updater.last_name as updated_by_last_name,
  g.created_at,
  g.updated_at
`;

const goalFromClause = `
  from public.goals g
  inner join public.teams team
    on team.id = g.team_id
  left join public.users target_user
    on target_user.id = g.target_user_id
  inner join public.users creator
    on creator.id = g.created_by_user_id
  left join public.users updater
    on updater.id = g.updated_by_user_id
`;

const buildAccessClauses = ({ teamIds, viewerUserId, onlyViewerRelevant }, values, whereClauses) => {
  values.push(teamIds);
  whereClauses.push(`g.team_id = any($${values.length}::uuid[])`);

  if (onlyViewerRelevant) {
    values.push(viewerUserId);
    whereClauses.push(`(g.scope = 'team' or g.target_user_id = $${values.length})`);
  }
};

const buildFilterClauses = (filters, values, whereClauses) => {
  if (filters.userId) {
    values.push(filters.userId);
    whereClauses.push(`g.target_user_id = $${values.length}`);
  }

  if (filters.goalType) {
    values.push(filters.goalType);
    whereClauses.push(`g.goal_type = $${values.length}`);
  }

  if (filters.scope) {
    values.push(filters.scope);
    whereClauses.push(`g.scope = $${values.length}`);
  }

  if (filters.period) {
    values.push(filters.period);
    whereClauses.push(`g.period = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    whereClauses.push(`g.status = $${values.length}`);
  }

  if (filters.includeCancelled === false) {
    whereClauses.push(`g.status <> 'cancelled'`);
  }
};

const buildOrderClause = (sortBy, sortOrder) => {
  const direction = sortOrder === "desc" ? "desc" : "asc";
  const progressExpression = `
    case
      when g.target_value = 0 then 0
      else round((g.actual_value / g.target_value) * 100, 2)
    end
  `;

  switch (sortBy) {
    case "createdAt":
      return `g.created_at ${direction}, g.end_date asc, g.title asc`;
    case "progressPercent":
      return `${progressExpression} ${direction}, g.end_date asc, g.title asc`;
    case "targetValue":
      return `g.target_value ${direction}, g.end_date asc, g.title asc`;
    case "title":
      return `g.title ${direction}, g.end_date asc`;
    default:
      return `g.end_date ${direction}, g.created_at desc, g.title asc`;
  }
};

export const createEmptyGoalList = () => ({
  goals: [],
  total: 0,
  summary: createEmptyGoalSummary(),
  charts: {
    byStatus: fillCountSeries([], "status", GOAL_STATUS_VALUES),
    byType: fillCountSeries([], "goalType", GOAL_TYPE_VALUES),
    byPeriod: fillCountSeries([], "period", GOAL_PERIOD_VALUES),
    byScope: fillCountSeries([], "scope", GOAL_SCOPE_VALUES)
  }
});

export const listGoalsForScope = async (
  { teamIds, viewerUserId = null, onlyViewerRelevant = false, filters = {} },
  { pool = getPool() } = {}
) => {
  const values = [];
  const whereClauses = [];

  buildAccessClauses({ teamIds, viewerUserId, onlyViewerRelevant }, values, whereClauses);
  buildFilterClauses(filters, values, whereClauses);

  const whereSql = `where ${whereClauses.join(" and ")}`;
  const limit = filters.limit ?? 50;
  const page = filters.page ?? 1;
  const offset = (page - 1) * limit;
  const listValues = [...values, limit, offset];

  const [
    countResult,
    listResult,
    summaryResult,
    totalsByUnitResult,
    byStatusResult,
    byTypeResult,
    byPeriodResult,
    byScopeResult
  ] = await Promise.all([
    pool.query(
      `
        select count(*) as total
        ${goalFromClause}
        ${whereSql}
      `,
      values
    ),
    pool.query(
      `
        select
          ${goalSelectColumns}
        ${goalFromClause}
        ${whereSql}
        order by ${buildOrderClause(filters.sortBy, filters.sortOrder)}
        limit $${listValues.length - 1}
        offset $${listValues.length}
      `,
      listValues
    ),
    pool.query(
      `
        select
          count(*) as total_goal_count,
          count(*) filter (where g.status = 'active') as active_goal_count,
          count(*) filter (where g.status = 'cancelled') as cancelled_goal_count,
          count(*) filter (
            where g.status <> 'cancelled'
              and g.actual_value >= g.target_value
          ) as achieved_goal_count,
          count(*) filter (
            where g.status = 'active'
              and g.actual_value < g.target_value
          ) as open_goal_count,
          coalesce(avg((g.actual_value / nullif(g.target_value, 0)) * 100), 0)
            as average_progress_percent,
          coalesce(sum(g.target_value), 0) as total_target_value,
          coalesce(sum(g.actual_value), 0) as total_actual_value
        ${goalFromClause}
        ${whereSql}
      `,
      values
    ),
    pool.query(
      `
        select
          g.unit,
          count(*) as goal_count,
          count(*) filter (
            where g.status <> 'cancelled'
              and g.actual_value >= g.target_value
          ) as achieved_goal_count,
          count(*) filter (where g.status = 'active') as active_goal_count,
          count(*) filter (
            where g.status = 'active'
              and g.actual_value < g.target_value
          ) as open_goal_count,
          coalesce(avg((g.actual_value / nullif(g.target_value, 0)) * 100), 0)
            as average_progress_percent,
          coalesce(sum(g.target_value), 0) as total_target_value,
          coalesce(sum(g.actual_value), 0) as total_actual_value
        ${goalFromClause}
        ${whereSql}
        group by g.unit
        order by g.unit asc
      `,
      values
    ),
    pool.query(
      `
        select
          g.status,
          count(*) as count
        ${goalFromClause}
        ${whereSql}
        group by g.status
        order by g.status asc
      `,
      values
    ),
    pool.query(
      `
        select
          g.goal_type as "goalType",
          count(*) as count
        ${goalFromClause}
        ${whereSql}
        group by g.goal_type
        order by g.goal_type asc
      `,
      values
    ),
    pool.query(
      `
        select
          g.period,
          count(*) as count
        ${goalFromClause}
        ${whereSql}
        group by g.period
        order by g.period asc
      `,
      values
    ),
    pool.query(
      `
        select
          g.scope,
          count(*) as count
        ${goalFromClause}
        ${whereSql}
        group by g.scope
        order by g.scope asc
      `,
      values
    )
  ]);

  const summaryRow = summaryResult.rows[0] ?? {};

  return {
    goals: listResult.rows.map(mapGoalRow),
    total: Number(countResult.rows[0]?.total ?? 0),
    summary: buildGoalSummary(summaryRow, totalsByUnitResult.rows),
    charts: {
      byStatus: fillCountSeries(byStatusResult.rows, "status", GOAL_STATUS_VALUES),
      byType: fillCountSeries(byTypeResult.rows, "goalType", GOAL_TYPE_VALUES),
      byPeriod: fillCountSeries(byPeriodResult.rows, "period", GOAL_PERIOD_VALUES),
      byScope: fillCountSeries(byScopeResult.rows, "scope", GOAL_SCOPE_VALUES)
    }
  };
};

export const findGoalByIdForScope = async (
  { goalId, teamIds, viewerUserId = null, onlyViewerRelevant = false },
  { pool = getPool() } = {}
) => {
  const values = [goalId];
  const whereClauses = ["g.id = $1"];

  buildAccessClauses({ teamIds, viewerUserId, onlyViewerRelevant }, values, whereClauses);

  const result = await pool.query(
    `
      select
        ${goalSelectColumns}
      ${goalFromClause}
      where ${whereClauses.join(" and ")}
    `,
    values
  );

  return result.rows[0] ? mapGoalRow(result.rows[0]) : null;
};

export const createGoal = async (
  goal,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.goals (
        team_id,
        target_user_id,
        title,
        description,
        goal_type,
        scope,
        period,
        start_date,
        end_date,
        target_value,
        actual_value,
        unit,
        status,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      returning id
    `,
    [
      goal.teamId,
      goal.targetUserId ?? null,
      goal.title,
      goal.description ?? null,
      goal.goalType,
      goal.scope,
      goal.period,
      goal.startDate,
      goal.endDate,
      goal.targetValue,
      goal.actualValue,
      goal.unit,
      goal.status,
      goal.createdByUserId,
      goal.updatedByUserId ?? null
    ]
  );

  return result.rows[0]?.id ?? null;
};

export const updateGoalById = async (
  goalId,
  patch,
  { pool = getPool() } = {}
) => {
  const columnMap = {
    teamId: "team_id",
    targetUserId: "target_user_id",
    title: "title",
    description: "description",
    goalType: "goal_type",
    scope: "scope",
    period: "period",
    startDate: "start_date",
    endDate: "end_date",
    targetValue: "target_value",
    actualValue: "actual_value",
    unit: "unit",
    status: "status",
    updatedByUserId: "updated_by_user_id"
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
    return goalId;
  }

  values.push(goalId);

  await pool.query(
    `
      update public.goals
      set ${setClauses.join(", ")}
      where id = $${values.length}
    `,
    values
  );

  return goalId;
};
