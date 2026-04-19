import "dotenv/config";
import {
  GOAL_PERIODS,
  GOAL_SCOPES,
  GOAL_STATUSES,
  GOAL_TYPES
} from "../src/constants/goals.js";
import { APP_ROLES } from "../src/constants/roles.js";
import { TASK_PRIORITIES, TASK_STATUSES } from "../src/constants/tasks.js";
import { closePool, getPool } from "../src/db/pool.js";
import { createGoal } from "../src/repositories/goal.repository.js";
import { createHoursLog } from "../src/repositories/hoursLogged.repository.js";
import {
  createTask,
  createTaskAssignment
} from "../src/repositories/task.repository.js";
import {
  upsertTeam,
  upsertTeamMember
} from "../src/repositories/team.repository.js";

const DEMO_GROUP_NAME = "Physical Demo Group";
const DEMO_GROUP_DESCRIPTION =
  "Repeatable live demo team with seeded tasks, join access, and assignments.";

const DEMO_EMAILS = {
  manager: "manager.demo@cloudcomputing.local",
  employeeOne: "employee.one@cloudcomputing.local",
  employeeTwo: "employee.two@cloudcomputing.local"
};

const formatDate = (value) => value.toISOString().slice(0, 10);

const addDays = (value, days) => {
  const next = new Date(value);

  next.setUTCDate(next.getUTCDate() + days);

  return next;
};

const setUtcTime = (value, hours, minutes = 0) => {
  const next = new Date(value);

  next.setUTCHours(hours, minutes, 0, 0);

  return next;
};

const startOfUtcDay = (value = new Date()) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const startOfUtcWeekMonday = (value = new Date()) => {
  const dayStart = startOfUtcDay(value);
  const isoDay = dayStart.getUTCDay() === 0 ? 7 : dayStart.getUTCDay();

  return addDays(dayStart, 1 - isoDay);
};

const findUsersByEmail = async (emails, client) => {
  const result = await client.query(
    `
      select
        id,
        email,
        first_name,
        last_name,
        app_role,
        is_active
      from public.users
      where lower(email) = any($1::text[])
    `,
    [emails.map((email) => email.toLowerCase())]
  );

  return result.rows;
};

const deleteExistingDemoData = async (teamId, client) => {
  await client.query(`delete from public.goals where team_id = $1`, [teamId]);
  await client.query(`delete from public.hours_logged where team_id = $1`, [teamId]);
  await client.query(`delete from public.tasks where team_id = $1`, [teamId]);
};

const main = async () => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const team = await upsertTeam(
      {
        name: DEMO_GROUP_NAME,
        description: DEMO_GROUP_DESCRIPTION
      },
      { pool: client }
    );

    const users = await findUsersByEmail(Object.values(DEMO_EMAILS), client);
    const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

    const manager = usersByEmail.get(DEMO_EMAILS.manager);
    const employeeOne = usersByEmail.get(DEMO_EMAILS.employeeOne);
    const employeeTwo = usersByEmail.get(DEMO_EMAILS.employeeTwo);

    if (!manager || !employeeOne || !employeeTwo) {
      throw new Error(
        "Demo users are missing. Run `npm run seed:demo-users` before seeding the demo group."
      );
    }

    if (manager.app_role !== APP_ROLES.MANAGER) {
      throw new Error("The demo manager account is not configured with the manager role.");
    }

    for (const membership of [
      { userId: manager.id, membershipRole: "manager" },
      { userId: employeeOne.id, membershipRole: "member" },
      { userId: employeeTwo.id, membershipRole: "member" }
    ]) {
      await upsertTeamMember(
        {
          teamId: team.id,
          userId: membership.userId,
          membershipRole: membership.membershipRole
        },
        { pool: client }
      );
    }

    await deleteExistingDemoData(team.id, client);

    const today = startOfUtcDay();
    const weekStartDate = formatDate(startOfUtcWeekMonday(today));
    const yesterday = addDays(today, -1);
    const twoDaysAgo = addDays(today, -2);
    const tomorrow = addDays(today, 1);
    const threeDaysFromNow = addDays(today, 3);

    const taskDefinitions = [
      {
        key: "manifestReview",
        title: "[DEMO] Loading manifest review",
        description: "Review outbound manifest totals before the afternoon dispatch window.",
        notes: "Manager wants a clean sign-off before 5 PM.",
        status: TASK_STATUSES.TODO,
        priority: TASK_PRIORITIES.HIGH,
        dueAt: setUtcTime(tomorrow, 17).toISOString(),
        estimatedHours: 2.5,
        progressPercent: 0,
        assigneeUserId: employeeOne.id,
        assignmentNote: "Please finish before the loading bay review."
      },
      {
        key: "inventoryReconciliation",
        title: "[DEMO] Inventory reconciliation",
        description: "Compare physical count against the system for aisle C and aisle D.",
        notes: "Escalate mismatches over 5 units.",
        status: TASK_STATUSES.IN_PROGRESS,
        priority: TASK_PRIORITIES.URGENT,
        dueAt: setUtcTime(today, 20).toISOString(),
        estimatedHours: 4,
        progressPercent: 45,
        assigneeUserId: employeeTwo.id,
        assignmentNote: "This is the highest-priority task for today."
      },
      {
        key: "dispatchReport",
        title: "[DEMO] Weekly dispatch report",
        description: "Send the weekly dispatch performance summary to management.",
        notes: "Completed ahead of the Friday review meeting.",
        status: TASK_STATUSES.COMPLETED,
        priority: TASK_PRIORITIES.MEDIUM,
        dueAt: setUtcTime(yesterday, 16).toISOString(),
        estimatedHours: 1.5,
        progressPercent: 100,
        completedAt: setUtcTime(yesterday, 14, 30).toISOString(),
        assigneeUserId: employeeOne.id,
        assignmentNote: "Attach completion notes for the team meeting."
      },
      {
        key: "safetyAudit",
        title: "[DEMO] Safety equipment audit",
        description: "Verify that floor safety stations are stocked and logged.",
        notes: "Blocked pending replacement goggles for station 4.",
        status: TASK_STATUSES.BLOCKED,
        priority: TASK_PRIORITIES.HIGH,
        dueAt: setUtcTime(twoDaysAgo, 15).toISOString(),
        estimatedHours: 3,
        progressPercent: 20,
        assigneeUserId: employeeTwo.id,
        assignmentNote: "Document blockers clearly for the manager dashboard."
      }
    ];

    const seededTaskIds = {};

    for (const taskDefinition of taskDefinitions) {
      const taskId = await createTask(
        {
          teamId: team.id,
          title: taskDefinition.title,
          description: taskDefinition.description,
          notes: taskDefinition.notes,
          status: taskDefinition.status,
          priority: taskDefinition.priority,
          dueAt: taskDefinition.dueAt,
          weekStartDate,
          estimatedHours: taskDefinition.estimatedHours,
          progressPercent: taskDefinition.progressPercent,
          createdByUserId: manager.id,
          updatedByUserId: manager.id,
          completedAt: taskDefinition.completedAt ?? null
        },
        { pool: client }
      );

      seededTaskIds[taskDefinition.key] = taskId;

      await createTaskAssignment(
        {
          taskId,
          assigneeUserId: taskDefinition.assigneeUserId,
          assignedByUserId: manager.id,
          assignmentNote: taskDefinition.assignmentNote
        },
        { pool: client }
      );
    }

    for (const hoursEntry of [
      {
        userId: employeeOne.id,
        taskId: seededTaskIds.manifestReview,
        workDate: formatDate(today),
        hours: 2.25,
        note: "Reviewed the loading manifest and corrected two mismatched carton counts."
      },
      {
        userId: employeeTwo.id,
        taskId: seededTaskIds.inventoryReconciliation,
        workDate: formatDate(today),
        hours: 3.5,
        note: "Reconciled aisle C and logged a pending mismatch for aisle D."
      },
      {
        userId: employeeOne.id,
        taskId: seededTaskIds.dispatchReport,
        workDate: formatDate(yesterday),
        hours: 1.5,
        note: "Compiled and submitted the weekly dispatch summary."
      }
    ]) {
      await createHoursLog(
        {
          userId: hoursEntry.userId,
          teamId: team.id,
          taskId: hoursEntry.taskId,
          workDate: hoursEntry.workDate,
          hours: hoursEntry.hours,
          note: hoursEntry.note,
          createdByUserId: hoursEntry.userId,
          updatedByUserId: hoursEntry.userId
        },
        { pool: client }
      );
    }

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

    for (const goal of [
      {
        teamId: team.id,
        targetUserId: employeeOne.id,
        title: "[DEMO] Monthly sales quota",
        description: "Track this employee's monthly outbound sales support target.",
        goalType: GOAL_TYPES.SALES_QUOTA,
        scope: GOAL_SCOPES.USER,
        period: GOAL_PERIODS.MONTHLY,
        startDate: formatDate(monthStart),
        endDate: formatDate(monthEnd),
        targetValue: 15000,
        actualValue: 7200,
        unit: "USD",
        status: GOAL_STATUSES.ACTIVE
      },
      {
        teamId: team.id,
        targetUserId: null,
        title: "[DEMO] Weekly throughput goal",
        description: "Shared team target for completed operational tasks this week.",
        goalType: GOAL_TYPES.SALES_QUOTA,
        scope: GOAL_SCOPES.TEAM,
        period: GOAL_PERIODS.WEEKLY,
        startDate: weekStartDate,
        endDate: formatDate(threeDaysFromNow),
        targetValue: 40,
        actualValue: 26,
        unit: "tasks",
        status: GOAL_STATUSES.ACTIVE
      }
    ]) {
      await createGoal(
        {
          ...goal,
          createdByUserId: manager.id,
          updatedByUserId: manager.id
        },
        { pool: client }
      );
    }

    await client.query("commit");

    console.log(
      JSON.stringify(
        {
          message: "Physical demo group is ready.",
          team: {
            id: team.id,
            name: team.name,
            description: team.description
          },
          users: {
            manager: {
              id: manager.id,
              email: manager.email
            },
            employeeOne: {
              id: employeeOne.id,
              email: employeeOne.email
            },
            employeeTwo: {
              id: employeeTwo.id,
              email: employeeTwo.email
            }
          },
          tasks: seededTaskIds
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

main()
  .catch((error) => {
    console.error("Failed to seed the physical demo group.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
