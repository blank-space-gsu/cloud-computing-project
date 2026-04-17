import { getPool } from "../db/pool.js";

const mapRecurringTaskRule = (row) => ({
  id: row.id,
  teamId: row.team_id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  defaultAssigneeUserId: row.default_assignee_user_id,
  frequency: row.frequency,
  weekdays: Array.isArray(row.weekdays) ? row.weekdays.map(Number) : null,
  dayOfMonth: row.day_of_month === null || row.day_of_month === undefined
    ? null
    : Number(row.day_of_month),
  dueTime: row.due_time,
  startsOn: row.starts_on?.toISOString?.().slice(0, 10) ?? row.starts_on,
  endsOn: row.ends_on?.toISOString?.().slice(0, 10) ?? row.ends_on ?? null,
  isActive: Boolean(row.is_active),
  createdByUserId: row.created_by_user_id,
  updatedByUserId: row.updated_by_user_id,
  createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
  updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at ?? null
});

export const createRecurringTaskRule = async (
  rule,
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      insert into public.recurring_task_rules (
        team_id,
        title,
        description,
        priority,
        default_assignee_user_id,
        frequency,
        weekdays,
        day_of_month,
        due_time,
        starts_on,
        ends_on,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::time, $10::date, $11::date, $12, $13)
      returning id
    `,
    [
      rule.teamId,
      rule.title,
      rule.description ?? null,
      rule.priority,
      rule.defaultAssigneeUserId ?? null,
      rule.frequency,
      rule.weekdays ?? null,
      rule.dayOfMonth ?? null,
      rule.dueTime,
      rule.startsOn,
      rule.endsOn ?? null,
      rule.createdByUserId,
      rule.updatedByUserId
    ]
  );

  return result.rows[0]?.id ?? null;
};

export const findRecurringTaskRuleById = async (
  { ruleId },
  { pool = getPool() } = {}
) => {
  const result = await pool.query(
    `
      select
        id,
        team_id,
        title,
        description,
        priority,
        default_assignee_user_id,
        frequency,
        weekdays,
        day_of_month,
        to_char(due_time, 'HH24:MI') as due_time,
        starts_on,
        ends_on,
        is_active,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      from public.recurring_task_rules
      where id = $1
    `,
    [ruleId]
  );

  return result.rows[0] ? mapRecurringTaskRule(result.rows[0]) : null;
};

export const listActiveRecurringTaskRulesForTeams = async (
  { teamIds, windowStartDate, windowEndDate },
  { pool = getPool() } = {}
) => {
  if (!teamIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      select
        id,
        team_id,
        title,
        description,
        priority,
        default_assignee_user_id,
        frequency,
        weekdays,
        day_of_month,
        to_char(due_time, 'HH24:MI') as due_time,
        starts_on,
        ends_on,
        is_active,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      from public.recurring_task_rules
      where team_id = any($1::uuid[])
        and is_active = true
        and starts_on <= $2::date
        and (ends_on is null or ends_on >= $3::date)
      order by created_at asc
    `,
    [teamIds, windowEndDate, windowStartDate]
  );

  return result.rows.map(mapRecurringTaskRule);
};

export const listGeneratedRecurringTaskDates = async (
  { ruleIds, windowStartDate, windowEndDate },
  { pool = getPool() } = {}
) => {
  if (!ruleIds.length) {
    return [];
  }

  const result = await pool.query(
    `
      select
        recurring_rule_id,
        generated_for_date
      from public.tasks
      where recurring_rule_id = any($1::uuid[])
        and generated_for_date >= $2::date
        and generated_for_date <= $3::date
    `,
    [ruleIds, windowStartDate, windowEndDate]
  );

  return result.rows.map((row) => ({
    recurringRuleId: row.recurring_rule_id,
    generatedForDate:
      row.generated_for_date?.toISOString?.().slice(0, 10)
      ?? row.generated_for_date
  }));
};
