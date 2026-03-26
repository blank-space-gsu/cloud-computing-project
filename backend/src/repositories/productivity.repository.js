import { getPool } from "../db/pool.js";

const CLOSED_TASK_STATUSES_SQL = `('completed', 'cancelled')`;

const createEmptyTaskAggregate = () => ({
  taskCount: 0,
  completedTaskCount: 0,
  openTaskCount: 0,
  inProgressTaskCount: 0,
  blockedTaskCount: 0,
  overdueTaskCount: 0,
  urgentTaskCount: 0,
  averageProgressPercent: 0,
  estimatedHours: 0
});

const createEmptyHoursAggregate = () => ({
  hoursEntryCount: 0,
  loggedHours: 0
});

const taskFromClause = `
  from public.tasks t
  left join public.task_assignments active_assignment
    on active_assignment.task_id = t.id
    and active_assignment.is_active = true
`;

const hoursFromClause = `
  from public.hours_logged hl
`;

const buildTaskScopeClauses = ({ teamIds = [], userId, startDate, endDate }) => {
  const values = [startDate, endDate, teamIds];
  const whereClauses = [
    "t.week_start_date between $1::date and $2::date",
    "t.team_id = any($3::uuid[])"
  ];

  if (userId) {
    values.push(userId);
    whereClauses.push(`active_assignment.assignee_user_id = $${values.length}`);
  }

  return {
    values,
    whereSql: `where ${whereClauses.join(" and ")}`
  };
};

const buildHoursScopeClauses = ({ teamIds = [], userId, startDate, endDate }) => {
  const values = [startDate, endDate, teamIds];
  const whereClauses = [
    "hl.work_date between $1::date and $2::date",
    "hl.team_id = any($3::uuid[])"
  ];

  if (userId) {
    values.push(userId);
    whereClauses.push(`hl.user_id = $${values.length}`);
  }

  return {
    values,
    whereSql: `where ${whereClauses.join(" and ")}`
  };
};

const normalizeTaskAggregate = (row) => ({
  taskCount: Number(row?.task_count ?? 0),
  completedTaskCount: Number(row?.completed_task_count ?? 0),
  openTaskCount: Number(row?.open_task_count ?? 0),
  inProgressTaskCount: Number(row?.in_progress_task_count ?? 0),
  blockedTaskCount: Number(row?.blocked_task_count ?? 0),
  overdueTaskCount: Number(row?.overdue_task_count ?? 0),
  urgentTaskCount: Number(row?.urgent_task_count ?? 0),
  averageProgressPercent: Number(row?.average_progress_percent ?? 0),
  estimatedHours: Number(row?.estimated_hours ?? 0)
});

const normalizeHoursAggregate = (row) => ({
  hoursEntryCount: Number(row?.hours_entry_count ?? 0),
  loggedHours: Number(row?.logged_hours ?? 0)
});

const buildRollup = (taskAggregate, hoursAggregate, range) => {
  const taskCount = taskAggregate.taskCount ?? 0;
  const completedTaskCount = taskAggregate.completedTaskCount ?? 0;
  const estimatedHours = taskAggregate.estimatedHours ?? 0;
  const loggedHours = hoursAggregate.loggedHours ?? 0;

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    taskCount,
    completedTaskCount,
    openTaskCount: taskAggregate.openTaskCount ?? 0,
    inProgressTaskCount: taskAggregate.inProgressTaskCount ?? 0,
    blockedTaskCount: taskAggregate.blockedTaskCount ?? 0,
    overdueTaskCount: taskAggregate.overdueTaskCount ?? 0,
    urgentTaskCount: taskAggregate.urgentTaskCount ?? 0,
    averageProgressPercent: taskAggregate.averageProgressPercent ?? 0,
    estimatedHours,
    hoursEntryCount: hoursAggregate.hoursEntryCount ?? 0,
    loggedHours,
    completionRate:
      taskCount === 0 ? 0 : Number(((completedTaskCount / taskCount) * 100).toFixed(2)),
    loggedVsEstimatedPercent:
      estimatedHours === 0 ? 0 : Number(((loggedHours / estimatedHours) * 100).toFixed(2))
  };
};

const mergeTrendRows = (periods, taskRows, hoursRows) => {
  const taskRowsByPeriod = new Map(
    taskRows.map((row) => [
      row.period_start?.toISOString?.().slice(0, 10) ?? row.period_start,
      row
    ])
  );
  const hoursRowsByPeriod = new Map(
    hoursRows.map((row) => [
      row.period_start?.toISOString?.().slice(0, 10) ?? row.period_start,
      row
    ])
  );

  return periods.map((period) => {
    const taskRow = taskRowsByPeriod.get(period.startDate);
    const hoursRow = hoursRowsByPeriod.get(period.startDate);
    const taskCount = Number(taskRow?.task_count ?? 0);
    const completedTaskCount = Number(taskRow?.completed_task_count ?? 0);
    const loggedHours = Number(hoursRow?.logged_hours ?? 0);

    return {
      startDate: period.startDate,
      endDate: period.endDate,
      taskCount,
      completedTaskCount,
      hoursEntryCount: Number(hoursRow?.hours_entry_count ?? 0),
      loggedHours,
      completionRate:
        taskCount === 0 ? 0 : Number(((completedTaskCount / taskCount) * 100).toFixed(2))
    };
  });
};

const mapMemberBreakdownRow = (row) => {
  const taskCount = Number(row.task_count ?? 0);
  const completedTaskCount = Number(row.completed_task_count ?? 0);
  const estimatedHours = Number(row.estimated_hours ?? 0);
  const loggedHours = Number(row.logged_hours ?? 0);

  return {
    userId: row.user_id,
    fullName: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
    jobTitle: row.job_title,
    taskCount,
    completedTaskCount,
    openTaskCount: Number(row.open_task_count ?? 0),
    averageProgressPercent: Number(row.average_progress_percent ?? 0),
    estimatedHours,
    hoursEntryCount: Number(row.hours_entry_count ?? 0),
    loggedHours,
    completionRate:
      taskCount === 0 ? 0 : Number(((completedTaskCount / taskCount) * 100).toFixed(2)),
    loggedVsEstimatedPercent:
      estimatedHours === 0 ? 0 : Number(((loggedHours / estimatedHours) * 100).toFixed(2))
  };
};

const loadTaskAggregate = async (
  scope,
  { pool = getPool() } = {}
) => {
  const { values, whereSql } = buildTaskScopeClauses(scope);

  const result = await pool.query(
    `
      select
        count(*) as task_count,
        count(*) filter (where t.status = 'completed') as completed_task_count,
        count(*) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
        count(*) filter (where t.status = 'in_progress') as in_progress_task_count,
        count(*) filter (where t.status = 'blocked') as blocked_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        count(*) filter (
          where t.priority = 'urgent'
            and t.status not in ${CLOSED_TASK_STATUSES_SQL}
        ) as urgent_task_count,
        coalesce(avg(t.progress_percent), 0) as average_progress_percent,
        coalesce(sum(t.estimated_hours), 0) as estimated_hours
      ${taskFromClause}
      ${whereSql}
    `,
    values
  );

  return normalizeTaskAggregate(result.rows[0]);
};

const loadHoursAggregate = async (
  scope,
  { pool = getPool() } = {}
) => {
  const { values, whereSql } = buildHoursScopeClauses(scope);

  const result = await pool.query(
    `
      select
        count(*) as hours_entry_count,
        coalesce(sum(hl.hours), 0) as logged_hours
      ${hoursFromClause}
      ${whereSql}
    `,
    values
  );

  return normalizeHoursAggregate(result.rows[0]);
};

const loadTaskTrend = async (
  { teamIds, userId, startDate, endDate, granularity },
  { pool = getPool() } = {}
) => {
  const { values, whereSql } = buildTaskScopeClauses({
    teamIds,
    userId,
    startDate,
    endDate
  });
  const periodExpression =
    granularity === "month"
      ? "date_trunc('month', t.week_start_date)::date"
      : "t.week_start_date";

  const result = await pool.query(
    `
      select
        ${periodExpression} as period_start,
        count(*) as task_count,
        count(*) filter (where t.status = 'completed') as completed_task_count
      ${taskFromClause}
      ${whereSql}
      group by period_start
      order by period_start asc
    `,
    values
  );

  return result.rows;
};

const loadHoursTrend = async (
  { teamIds, userId, startDate, endDate, granularity },
  { pool = getPool() } = {}
) => {
  const { values, whereSql } = buildHoursScopeClauses({
    teamIds,
    userId,
    startDate,
    endDate
  });
  const periodExpression =
    granularity === "month"
      ? "date_trunc('month', hl.work_date)::date"
      : "date_trunc('week', hl.work_date)::date";

  const result = await pool.query(
    `
      select
        ${periodExpression} as period_start,
        count(*) as hours_entry_count,
        coalesce(sum(hl.hours), 0) as logged_hours
      ${hoursFromClause}
      ${whereSql}
      group by period_start
      order by period_start asc
    `,
    values
  );

  return result.rows;
};

const loadMemberBreakdown = async (
  { teamIds, startDate, endDate },
  { pool = getPool() } = {}
) => {
  if (teamIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `
      with scoped_members as (
        select distinct
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.job_title
        from public.team_members tm
        inner join public.users u
          on u.id = tm.user_id
        where tm.team_id = any($1::uuid[])
          and u.is_active = true
      ),
      task_metrics as (
        select
          active_assignment.assignee_user_id as user_id,
          count(*) as task_count,
          count(*) filter (where t.status = 'completed') as completed_task_count,
          count(*) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
          coalesce(avg(t.progress_percent), 0) as average_progress_percent,
          coalesce(sum(t.estimated_hours), 0) as estimated_hours
        from public.tasks t
        inner join public.task_assignments active_assignment
          on active_assignment.task_id = t.id
          and active_assignment.is_active = true
        where t.team_id = any($1::uuid[])
          and t.week_start_date between $2::date and $3::date
        group by active_assignment.assignee_user_id
      ),
      hours_metrics as (
        select
          hl.user_id,
          count(*) as hours_entry_count,
          coalesce(sum(hl.hours), 0) as logged_hours
        from public.hours_logged hl
        where hl.team_id = any($1::uuid[])
          and hl.work_date between $2::date and $3::date
        group by hl.user_id
      )
      select
        scoped_members.user_id,
        scoped_members.first_name,
        scoped_members.last_name,
        scoped_members.job_title,
        coalesce(task_metrics.task_count, 0) as task_count,
        coalesce(task_metrics.completed_task_count, 0) as completed_task_count,
        coalesce(task_metrics.open_task_count, 0) as open_task_count,
        coalesce(task_metrics.average_progress_percent, 0) as average_progress_percent,
        coalesce(task_metrics.estimated_hours, 0) as estimated_hours,
        coalesce(hours_metrics.hours_entry_count, 0) as hours_entry_count,
        coalesce(hours_metrics.logged_hours, 0) as logged_hours
      from scoped_members
      left join task_metrics
        on task_metrics.user_id = scoped_members.user_id
      left join hours_metrics
        on hours_metrics.user_id = scoped_members.user_id
      order by
        coalesce(task_metrics.completed_task_count, 0) desc,
        coalesce(hours_metrics.logged_hours, 0) desc,
        scoped_members.first_name asc,
        scoped_members.last_name asc
    `,
    [teamIds, startDate, endDate]
  );

  return result.rows.map(mapMemberBreakdownRow);
};

export const getProductivitySnapshot = async (
  { teamIds = [], userId = null, ranges, includeMemberBreakdown = false },
  { pool = getPool() } = {}
) => {
  const weeklyScope = {
    teamIds,
    userId,
    startDate: ranges.weekly.startDate,
    endDate: ranges.weekly.endDate
  };
  const monthlyScope = {
    teamIds,
    userId,
    startDate: ranges.monthly.startDate,
    endDate: ranges.monthly.endDate
  };
  const yearlyScope = {
    teamIds,
    userId,
    startDate: ranges.yearly.startDate,
    endDate: ranges.yearly.endDate
  };
  const weeklyTrendScope = {
    teamIds,
    userId,
    startDate: ranges.weeklyTrend[0].startDate,
    endDate: ranges.weeklyTrend.at(-1)?.endDate ?? ranges.weekly.endDate,
    granularity: "week"
  };
  const monthlyTrendScope = {
    teamIds,
    userId,
    startDate: ranges.monthlyTrend[0].startDate,
    endDate: ranges.monthlyTrend.at(-1)?.endDate ?? ranges.monthly.endDate,
    granularity: "month"
  };

  const [
    weeklyTaskAggregate,
    monthlyTaskAggregate,
    yearlyTaskAggregate,
    weeklyHoursAggregate,
    monthlyHoursAggregate,
    yearlyHoursAggregate,
    weeklyTaskTrend,
    weeklyHoursTrend,
    monthlyTaskTrend,
    monthlyHoursTrend,
    memberBreakdown
  ] = await Promise.all([
    loadTaskAggregate(weeklyScope, { pool }),
    loadTaskAggregate(monthlyScope, { pool }),
    loadTaskAggregate(yearlyScope, { pool }),
    loadHoursAggregate(weeklyScope, { pool }),
    loadHoursAggregate(monthlyScope, { pool }),
    loadHoursAggregate(yearlyScope, { pool }),
    loadTaskTrend(weeklyTrendScope, { pool }),
    loadHoursTrend(weeklyTrendScope, { pool }),
    loadTaskTrend(monthlyTrendScope, { pool }),
    loadHoursTrend(monthlyTrendScope, { pool }),
    includeMemberBreakdown
      ? loadMemberBreakdown(
          {
            teamIds,
            startDate: ranges.monthly.startDate,
            endDate: ranges.monthly.endDate
          },
          { pool }
        )
      : Promise.resolve([])
  ]);

  return {
    rollups: {
      weekly: buildRollup(weeklyTaskAggregate, weeklyHoursAggregate, ranges.weekly),
      monthly: buildRollup(monthlyTaskAggregate, monthlyHoursAggregate, ranges.monthly),
      yearly: buildRollup(yearlyTaskAggregate, yearlyHoursAggregate, ranges.yearly)
    },
    charts: {
      weeklyTrend: mergeTrendRows(ranges.weeklyTrend, weeklyTaskTrend, weeklyHoursTrend),
      monthlyTrend: mergeTrendRows(ranges.monthlyTrend, monthlyTaskTrend, monthlyHoursTrend)
    },
    breakdown: {
      period: {
        name: "monthly",
        startDate: ranges.monthly.startDate,
        endDate: ranges.monthly.endDate
      },
      members: memberBreakdown
    }
  };
};

export const createEmptyProductivitySnapshot = (ranges) => ({
  rollups: {
    weekly: buildRollup(createEmptyTaskAggregate(), createEmptyHoursAggregate(), ranges.weekly),
    monthly: buildRollup(createEmptyTaskAggregate(), createEmptyHoursAggregate(), ranges.monthly),
    yearly: buildRollup(createEmptyTaskAggregate(), createEmptyHoursAggregate(), ranges.yearly)
  },
  charts: {
    weeklyTrend: mergeTrendRows(ranges.weeklyTrend, [], []),
    monthlyTrend: mergeTrendRows(ranges.monthlyTrend, [], [])
  },
  breakdown: {
    period: {
      name: "monthly",
      startDate: ranges.monthly.startDate,
      endDate: ranges.monthly.endDate
    },
    members: []
  }
});
