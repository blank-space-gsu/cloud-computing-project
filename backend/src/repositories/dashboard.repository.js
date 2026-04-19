import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from "../constants/tasks.js";
import { getPool } from "../db/pool.js";

const CLOSED_TASK_STATUSES_SQL = `('completed', 'cancelled')`;

const normalizeTimestamp = (value) => value?.toISOString?.() ?? value ?? null;

const fillCountSeries = (rows, keyName, expectedKeys) =>
  expectedKeys.map((key) => {
    const match = rows.find((row) => row[keyName] === key);

    return {
      [keyName]: key,
      count: Number(match?.count ?? 0)
    };
  });

const mapTaskPreview = (row) => {
  const dueAt = normalizeTimestamp(row.due_at);
  const dueAtMs = dueAt ? Date.parse(dueAt) : null;
  const now = Date.now();
  const isClosed = row.status === "completed" || row.status === "cancelled";

  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueAt,
    weekStartDate: row.week_start_date?.toISOString?.().slice(0, 10) ?? row.week_start_date,
    progressPercent: Number(row.progress_percent),
    timeRemainingSeconds:
      dueAtMs === null ? null : Math.floor((dueAtMs - now) / 1000),
    isOverdue: !isClosed && dueAtMs !== null && dueAtMs < now,
    isDueSoon:
      !isClosed &&
      dueAtMs !== null &&
      dueAtMs >= now &&
      dueAtMs <= now + (48 * 60 * 60 * 1000),
    assignment: row.assignee_user_id
      ? {
          assigneeUserId: row.assignee_user_id,
          assigneeFullName:
            `${row.assignee_first_name ?? ""} ${row.assignee_last_name ?? ""}`.trim()
        }
      : null
  };
};

const mapWorkloadRow = (row) => ({
  userId: row.user_id,
  fullName: `${row.first_name} ${row.last_name}`.trim(),
  jobTitle: row.job_title,
  taskCount: Number(row.assigned_task_count ?? 0),
  assignedTaskCount: Number(row.assigned_task_count ?? 0),
  completedTaskCount: Number(row.completed_task_count ?? 0),
  openTaskCount: Number(row.open_task_count ?? 0),
  inProgressTaskCount: Number(row.in_progress_task_count ?? 0),
  blockedTaskCount: Number(row.blocked_task_count ?? 0),
  overdueTaskCount: Number(row.overdue_task_count ?? 0),
  totalEstimatedHours:
    row.total_estimated_hours === null || row.total_estimated_hours === undefined
      ? 0
      : Number(row.total_estimated_hours),
  openEstimatedHours:
    row.open_estimated_hours === null || row.open_estimated_hours === undefined
      ? 0
      : Number(row.open_estimated_hours),
  averageProgressPercent:
    row.average_progress_percent === null || row.average_progress_percent === undefined
      ? 0
      : Number(row.average_progress_percent),
  completionRate:
    Number(row.assigned_task_count ?? 0) === 0
      ? 0
      : Number(
          (
            (Number(row.completed_task_count ?? 0) / Number(row.assigned_task_count ?? 0)) *
            100
          ).toFixed(2)
        )
});

const buildTeamFilterClause = (teamIds, startIndex = 1) => ({
  clause: `t.team_id = any($${startIndex}::uuid[])`,
  values: [teamIds]
});

export const getEmployeeDashboardSnapshot = async (
  { employeeUserId },
  { pool = getPool() } = {}
) => {
  const summaryResult = await pool.query(
    `
      select
        count(*) as assigned_task_count,
        count(*) filter (where t.status = 'completed') as completed_task_count,
        count(*) filter (where t.status = 'in_progress') as in_progress_task_count,
        count(*) filter (where t.status = 'todo') as todo_task_count,
        count(*) filter (where t.status = 'blocked') as blocked_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at between timezone('utc', now()) and timezone('utc', now()) + interval '48 hours'
        ) as due_soon_task_count,
        coalesce(avg(t.progress_percent), 0) as average_progress_percent,
        coalesce(sum(t.estimated_hours), 0) as total_estimated_hours,
        coalesce(
          sum(t.estimated_hours) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}),
          0
        ) as open_estimated_hours,
        count(*) filter (where t.week_start_date = date_trunc('week', timezone('utc', now()))::date) as current_week_task_count
      from public.tasks t
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
    `,
    [employeeUserId]
  );

  const statusCountsResult = await pool.query(
    `
      select
        t.status,
        count(*) as count
      from public.tasks t
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
      group by t.status
      order by t.status asc
    `,
    [employeeUserId]
  );

  const priorityCountsResult = await pool.query(
    `
      select
        t.priority,
        count(*) as count
      from public.tasks t
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
      group by t.priority
      order by t.priority asc
    `,
    [employeeUserId]
  );

  const weeklyBucketsResult = await pool.query(
    `
      select
        t.week_start_date,
        count(*) as count
      from public.tasks t
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
      group by t.week_start_date
      order by t.week_start_date asc
      limit 8
    `,
    [employeeUserId]
  );

  const upcomingDeadlinesResult = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.status,
        t.priority,
        t.due_at,
        t.week_start_date,
        t.progress_percent
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
        and t.status not in ${CLOSED_TASK_STATUSES_SQL}
        and t.due_at is not null
      order by t.due_at asc
      limit 5
    `,
    [employeeUserId]
  );

  const urgentTasksResult = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.status,
        t.priority,
        t.due_at,
        t.week_start_date,
        t.progress_percent
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      inner join public.task_assignments ta
        on ta.task_id = t.id
        and ta.is_active = true
      where ta.assignee_user_id = $1
        and t.status not in ${CLOSED_TASK_STATUSES_SQL}
        and t.priority = 'urgent'
      order by t.due_at asc nulls last, t.created_at desc
      limit 5
    `,
    [employeeUserId]
  );

  const summaryRow = summaryResult.rows[0] ?? {};
  const assignedTaskCount = Number(summaryRow.assigned_task_count ?? 0);
  const completedTaskCount = Number(summaryRow.completed_task_count ?? 0);

  return {
    summary: {
      assignedTaskCount,
      completedTaskCount,
      inProgressTaskCount: Number(summaryRow.in_progress_task_count ?? 0),
      todoTaskCount: Number(summaryRow.todo_task_count ?? 0),
      blockedTaskCount: Number(summaryRow.blocked_task_count ?? 0),
      overdueTaskCount: Number(summaryRow.overdue_task_count ?? 0),
      dueSoonTaskCount: Number(summaryRow.due_soon_task_count ?? 0),
      averageProgressPercent: Number(summaryRow.average_progress_percent ?? 0),
      totalEstimatedHours: Number(summaryRow.total_estimated_hours ?? 0),
      openEstimatedHours: Number(summaryRow.open_estimated_hours ?? 0),
      currentWeekTaskCount: Number(summaryRow.current_week_task_count ?? 0),
      completionRate:
        assignedTaskCount === 0
          ? 0
          : Number(((completedTaskCount / assignedTaskCount) * 100).toFixed(2))
    },
    charts: {
      byStatus: fillCountSeries(statusCountsResult.rows, "status", TASK_STATUS_VALUES),
      byPriority: fillCountSeries(priorityCountsResult.rows, "priority", TASK_PRIORITY_VALUES),
      byWeek: weeklyBucketsResult.rows.map((row) => ({
        weekStartDate:
          row.week_start_date?.toISOString?.().slice(0, 10) ?? row.week_start_date,
        count: Number(row.count)
      }))
    },
    tasks: {
      upcomingDeadlines: upcomingDeadlinesResult.rows.map(mapTaskPreview),
      urgentTasks: urgentTasksResult.rows.map(mapTaskPreview)
    }
  };
};

export const getManagerDashboardSnapshot = async (
  { teamIds },
  { pool = getPool() } = {}
) => {
  const teamFilter = buildTeamFilterClause(teamIds);

  const summaryResult = await pool.query(
    `
      select
        count(*) as total_task_count,
        count(*) filter (where t.status = 'completed') as completed_task_count,
        count(*) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at between timezone('utc', now()) and timezone('utc', now()) + interval '48 hours'
        ) as due_soon_task_count,
        count(*) filter (where active_assignment.id is null) as unassigned_task_count,
        count(*) filter (where t.priority = 'urgent' and t.status not in ${CLOSED_TASK_STATUSES_SQL}) as urgent_task_count,
        coalesce(avg(t.progress_percent), 0) as average_progress_percent
      from public.tasks t
      left join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      where ${teamFilter.clause}
    `,
    teamFilter.values
  );

  const statusCountsResult = await pool.query(
    `
      select
        t.status,
        count(*) as count
      from public.tasks t
      where ${teamFilter.clause}
      group by t.status
      order by t.status asc
    `,
    teamFilter.values
  );

  const priorityCountsResult = await pool.query(
    `
      select
        t.priority,
        count(*) as count
      from public.tasks t
      where ${teamFilter.clause}
      group by t.priority
      order by t.priority asc
    `,
    teamFilter.values
  );

  const workloadResult = await pool.query(
    `
      select
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.job_title,
        count(*) as assigned_task_count,
        count(*) filter (where t.status = 'completed') as completed_task_count,
        count(*) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}) as open_task_count,
        count(*) filter (where t.status = 'in_progress') as in_progress_task_count,
        count(*) filter (where t.status = 'blocked') as blocked_task_count,
        count(*) filter (
          where t.status not in ${CLOSED_TASK_STATUSES_SQL}
            and t.due_at is not null
            and t.due_at < timezone('utc', now())
        ) as overdue_task_count,
        coalesce(sum(t.estimated_hours), 0) as total_estimated_hours,
        coalesce(
          sum(t.estimated_hours) filter (where t.status not in ${CLOSED_TASK_STATUSES_SQL}),
          0
        ) as open_estimated_hours,
        coalesce(avg(t.progress_percent), 0) as average_progress_percent
      from public.task_assignments ta
      inner join public.tasks t
        on t.id = ta.task_id
      inner join public.users u
        on u.id = ta.assignee_user_id
      where ta.is_active = true
        and ${teamFilter.clause}
      group by
        u.id,
        u.first_name,
        u.last_name,
        u.job_title
      order by
        assigned_task_count desc,
        u.first_name asc,
        u.last_name asc
    `,
    teamFilter.values
  );

  const upcomingDeadlinesResult = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.status,
        t.priority,
        t.due_at,
        t.week_start_date,
        t.progress_percent,
        assignee.id as assignee_user_id,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      left join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      left join public.users assignee
        on assignee.id = active_assignment.assignee_user_id
      where ${teamFilter.clause}
        and t.status not in ${CLOSED_TASK_STATUSES_SQL}
        and t.due_at is not null
      order by t.due_at asc
      limit 5
    `,
    teamFilter.values
  );

  const urgentTasksResult = await pool.query(
    `
      select
        t.id,
        t.team_id,
        team.name as team_name,
        t.title,
        t.status,
        t.priority,
        t.due_at,
        t.week_start_date,
        t.progress_percent,
        assignee.id as assignee_user_id,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name
      from public.tasks t
      inner join public.teams team
        on team.id = t.team_id
      left join public.task_assignments active_assignment
        on active_assignment.task_id = t.id
        and active_assignment.is_active = true
      left join public.users assignee
        on assignee.id = active_assignment.assignee_user_id
      where ${teamFilter.clause}
        and t.status not in ${CLOSED_TASK_STATUSES_SQL}
        and (t.priority = 'urgent' or (t.due_at is not null and t.due_at < timezone('utc', now())))
      order by
        case
          when t.due_at is not null and t.due_at < timezone('utc', now()) then 0
          when t.priority = 'urgent' then 1
          else 2
        end,
        t.due_at asc nulls last
      limit 5
    `,
    teamFilter.values
  );

  const summaryRow = summaryResult.rows[0] ?? {};
  const totalTaskCount = Number(summaryRow.total_task_count ?? 0);
  const completedTaskCount = Number(summaryRow.completed_task_count ?? 0);

  return {
    summary: {
      totalTaskCount,
      completedTaskCount,
      openTaskCount: Number(summaryRow.open_task_count ?? 0),
      overdueTaskCount: Number(summaryRow.overdue_task_count ?? 0),
      dueSoonTaskCount: Number(summaryRow.due_soon_task_count ?? 0),
      unassignedTaskCount: Number(summaryRow.unassigned_task_count ?? 0),
      urgentTaskCount: Number(summaryRow.urgent_task_count ?? 0),
      averageProgressPercent: Number(summaryRow.average_progress_percent ?? 0),
      completionRate:
        totalTaskCount === 0
          ? 0
          : Number(((completedTaskCount / totalTaskCount) * 100).toFixed(2))
    },
    charts: {
      byStatus: fillCountSeries(statusCountsResult.rows, "status", TASK_STATUS_VALUES),
      byPriority: fillCountSeries(priorityCountsResult.rows, "priority", TASK_PRIORITY_VALUES),
      workloadByEmployee: workloadResult.rows.map(mapWorkloadRow)
    },
    tasks: {
      upcomingDeadlines: upcomingDeadlinesResult.rows.map(mapTaskPreview),
      urgentTasks: urgentTasksResult.rows.map(mapTaskPreview)
    }
  };
};
