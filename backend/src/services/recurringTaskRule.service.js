import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  RECURRING_TASK_FREQUENCIES,
  RECURRING_TASK_GENERATION_FUTURE_DAYS,
  RECURRING_TASK_GENERATION_PAST_DAYS
} from "../constants/recurringTasks.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../constants/tasks.js";
import { TASK_UPDATE_TYPES } from "../constants/taskUpdates.js";
import { getPool } from "../db/pool.js";
import {
  createRecurringTaskRule,
  findRecurringTaskRuleById,
  listActiveRecurringTaskRulesForTeams,
  listGeneratedRecurringTaskDates
} from "../repositories/recurringTaskRule.repository.js";
import {
  createTask,
  createTaskAssignment,
  createTaskUpdate,
  findAssignableUserInTeam
} from "../repositories/task.repository.js";
import { findAccessibleTeamById } from "../repositories/team.repository.js";
import { createAppError } from "../utils/appError.js";
import { listTeamsForUser } from "./team.service.js";

const TEAM_MANAGER_MEMBERSHIP_ROLE = "manager";

const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);
const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;

const ensurePrivilegedUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const ensureTeamCanBeManaged = async (
  authUser,
  teamId,
  { findTeam = findAccessibleTeamById } = {}
) => {
  const team = await findTeam({
    teamId,
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not accessible."
    });
  }

  if (!isAdminUser(authUser) && team.membershipRole !== TEAM_MANAGER_MEMBERSHIP_ROLE) {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGEMENT_FORBIDDEN",
      message: "You do not have permission to manage recurring tasks for this team."
    });
  }

  return team;
};

const runInTransaction = async (
  work,
  { pool = getPool() } = {}
) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const formatLocalDate = (value) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addLocalDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const parseIsoDateUtc = (value) => new Date(`${value}T00:00:00.000Z`);

const formatUtcDate = (value) => value.toISOString().slice(0, 10);

const addUtcDays = (value, days) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getMondayDateString = (isoDate) => {
  const value = parseIsoDateUtc(isoDate);
  const offset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - offset);
  return formatUtcDate(value);
};

const buildDueAtIso = (isoDate, dueTime) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hours, minutes] = dueTime.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
};

const buildGenerationWindow = (filters = {}) => {
  const today = new Date();
  const windowStartDate = filters.dateFrom
    ?? formatLocalDate(addLocalDays(today, -RECURRING_TASK_GENERATION_PAST_DAYS));
  const windowEndDate = filters.dateTo
    ?? formatLocalDate(addLocalDays(today, RECURRING_TASK_GENERATION_FUTURE_DAYS));

  return {
    windowStartDate,
    windowEndDate
  };
};

export const computeRecurringOccurrences = (
  rule,
  { windowStartDate, windowEndDate }
) => {
  const effectiveStartDate = rule.startsOn > windowStartDate
    ? rule.startsOn
    : windowStartDate;
  const effectiveEndDate = rule.endsOn && rule.endsOn < windowEndDate
    ? rule.endsOn
    : windowEndDate;

  if (effectiveStartDate > effectiveEndDate) {
    return [];
  }

  const occurrences = [];
  const cursor = parseIsoDateUtc(effectiveStartDate);
  const end = parseIsoDateUtc(effectiveEndDate);
  const weekdays = new Set((rule.weekdays ?? []).map(Number));

  while (cursor.getTime() <= end.getTime()) {
    const isoDate = formatUtcDate(cursor);
    const utcDay = cursor.getUTCDay();
    const utcDate = cursor.getUTCDate();

    if (rule.frequency === RECURRING_TASK_FREQUENCIES.DAILY) {
      occurrences.push(isoDate);
    } else if (rule.frequency === RECURRING_TASK_FREQUENCIES.WEEKLY) {
      if (weekdays.has(utcDay)) {
        occurrences.push(isoDate);
      }
    } else if (
      rule.frequency === RECURRING_TASK_FREQUENCIES.MONTHLY
      && utcDate === rule.dayOfMonth
    ) {
      occurrences.push(isoDate);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

const buildMissingOccurrenceMap = (rows) => {
  const seen = new Set();

  for (const row of rows) {
    seen.add(`${row.recurringRuleId}:${row.generatedForDate}`);
  }

  return seen;
};

const resolveRecurringTeamsForUser = async (
  authUser,
  filters,
  { listTeams = listTeamsForUser } = {}
) => {
  const visibleTeams = await listTeams(authUser);
  const scopedTeams = filters.teamId
    ? visibleTeams.filter((team) => team.id === filters.teamId)
    : visibleTeams;

  return scopedTeams.map((team) => team.id);
};

const insertRecurringTaskInstance = async (
  rule,
  occurrenceDate,
  {
    insertTask = createTask,
    insertTaskAssignment = createTaskAssignment,
    insertTaskUpdate = createTaskUpdate,
    findAssignee = findAssignableUserInTeam,
    runTransaction: transactionRunner = runInTransaction
  } = {}
) => {
  const assignee = rule.defaultAssigneeUserId
    ? await findAssignee({
        teamId: rule.teamId,
        userId: rule.defaultAssigneeUserId
      })
    : null;
  const validDefaultAssignee =
    assignee
    && assignee.isActive
    && assignee.appRole === APP_ROLES.EMPLOYEE
      ? assignee
      : null;

  try {
    await transactionRunner(async (client) => {
      const taskId = await insertTask(
        {
          teamId: rule.teamId,
          title: rule.title,
          description: rule.description ?? null,
          notes: null,
          status: TASK_STATUSES.TODO,
          priority: rule.priority ?? TASK_PRIORITIES.MEDIUM,
          dueAt: buildDueAtIso(occurrenceDate, rule.dueTime),
          weekStartDate: getMondayDateString(occurrenceDate),
          recurringRuleId: rule.id,
          generatedForDate: occurrenceDate,
          estimatedHours: null,
          progressPercent: 0,
          createdByUserId: rule.updatedByUserId ?? rule.createdByUserId,
          updatedByUserId: rule.updatedByUserId ?? rule.createdByUserId,
          completedAt: null
        },
        { pool: client }
      );

      await insertTaskUpdate(
        {
          taskId,
          updatedByUserId: rule.updatedByUserId ?? rule.createdByUserId,
          updateType: TASK_UPDATE_TYPES.CREATED,
          statusAfter: TASK_STATUSES.TODO,
          progressPercentAfter: 0,
          note: null
        },
        { pool: client }
      );

      if (validDefaultAssignee) {
        await insertTaskAssignment(
          {
            taskId,
            assigneeUserId: validDefaultAssignee.id,
            assignedByUserId: rule.updatedByUserId ?? rule.createdByUserId,
            assignmentNote: "Assigned from recurring task rule."
          },
          { pool: client }
        );

        await insertTaskUpdate(
          {
            taskId,
            updatedByUserId: rule.updatedByUserId ?? rule.createdByUserId,
            updateType: TASK_UPDATE_TYPES.ASSIGNED,
            statusAfter: TASK_STATUSES.TODO,
            progressPercentAfter: 0,
            note: "Assigned from recurring task rule.",
            assigneeUserId: validDefaultAssignee.id
          },
          { pool: client }
        );
      }
    });
  } catch (error) {
    if (error?.code === "23505") {
      return false;
    }

    throw error;
  }

  return true;
};

export const ensureRecurringTasksGeneratedForUser = async (
  authUser,
  filters = {},
  {
    listTeams = listTeamsForUser,
    listRules = listActiveRecurringTaskRulesForTeams,
    listGeneratedDates = listGeneratedRecurringTaskDates,
    insertTask = createTask,
    insertTaskAssignment = createTaskAssignment,
    insertTaskUpdate = createTaskUpdate,
    findAssignee = findAssignableUserInTeam,
    runTransaction: transactionRunner = runInTransaction
  } = {}
) => {
  const teamIds = await resolveRecurringTeamsForUser(
    authUser,
    filters,
    { listTeams }
  );

  if (!teamIds.length) {
    return {
      generatedCount: 0
    };
  }

  const { windowStartDate, windowEndDate } = buildGenerationWindow(filters);
  const rules = await listRules({
    teamIds,
    windowStartDate,
    windowEndDate
  });

  if (!rules.length) {
    return {
      generatedCount: 0
    };
  }

  const generatedRows = await listGeneratedDates({
    ruleIds: rules.map((rule) => rule.id),
    windowStartDate,
    windowEndDate
  });
  const seenOccurrences = buildMissingOccurrenceMap(generatedRows);

  let generatedCount = 0;

  for (const rule of rules) {
    const occurrences = computeRecurringOccurrences(rule, {
      windowStartDate,
      windowEndDate
    });

    for (const occurrenceDate of occurrences) {
      const occurrenceKey = `${rule.id}:${occurrenceDate}`;
      if (seenOccurrences.has(occurrenceKey)) {
        continue;
      }

      const inserted = await insertRecurringTaskInstance(
        rule,
        occurrenceDate,
        {
          insertTask,
          insertTaskAssignment,
          insertTaskUpdate,
          findAssignee,
          runTransaction: transactionRunner
        }
      );

      if (inserted) {
        seenOccurrences.add(occurrenceKey);
        generatedCount += 1;
      }
    }
  }

  return {
    generatedCount
  };
};

export const createRecurringTaskRuleForUser = async (
  authUser,
  input,
  {
    findTeam = findAccessibleTeamById,
    insertRule = createRecurringTaskRule,
    findRule = findRecurringTaskRuleById,
    findAssignee = findAssignableUserInTeam
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "RECURRING_TASK_RULE_CREATION_FORBIDDEN",
    "Only managers and admins can create recurring task rules."
  );

  await ensureTeamCanBeManaged(authUser, input.teamId, { findTeam });

  if (input.defaultAssigneeUserId) {
    const assignee = await findAssignee({
      teamId: input.teamId,
      userId: input.defaultAssigneeUserId
    });

    if (!assignee || !assignee.isActive) {
      throw createAppError({
        statusCode: 404,
        code: "ASSIGNEE_NOT_FOUND",
        message: "Assignee not found in the task team or is inactive."
      });
    }

    if (assignee.appRole !== APP_ROLES.EMPLOYEE) {
      throw createAppError({
        statusCode: 400,
        code: "INVALID_ASSIGNEE_ROLE",
        message: "Recurring tasks can only default to employee assignees."
      });
    }
  }

  const ruleId = await insertRule({
    teamId: input.teamId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? TASK_PRIORITIES.MEDIUM,
    defaultAssigneeUserId: input.defaultAssigneeUserId ?? null,
    frequency: input.frequency,
    weekdays: input.weekdays ?? null,
    dayOfMonth: input.dayOfMonth ?? null,
    dueTime: input.dueTime,
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
    createdByUserId: authUser.id,
    updatedByUserId: authUser.id
  });

  return findRule({ ruleId });
};
