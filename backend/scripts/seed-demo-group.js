import "dotenv/config";
import crypto from "node:crypto";
import { env } from "../src/config/env.js";
import { TASK_STATUSES } from "../src/constants/tasks.js";
import {
  TEAM_ACCESS_TOKEN_TYPES,
  TEAM_MEMBERSHIP_ROLES
} from "../src/constants/teamMemberships.js";
import { closePool, getPool } from "../src/db/pool.js";
import { createRecurringTaskRule } from "../src/repositories/recurringTaskRule.repository.js";
import {
  createTask,
  createTaskAssignment,
  createTaskUpdate
} from "../src/repositories/task.repository.js";
import {
  createTeamAccessToken,
  revokeActiveTeamAccessTokens,
  upsertTeam,
  upsertTeamMember
} from "../src/repositories/team.repository.js";
import { findUserAccessProfileByEmail } from "../src/repositories/user.repository.js";
import {
  DEMO_LOGIN_ACCOUNTS,
  DEMO_PRIMARY_TEAM_MEMBER_KEYS,
  DEMO_RECURRING_RULE_BLUEPRINTS,
  DEMO_TASK_BLUEPRINTS,
  DEMO_TEAM,
  DEMO_USERS
} from "./demo-fixture.js";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const startOfUtcDay = (value = new Date()) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

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

const formatDate = (value) => value.toISOString().slice(0, 10);

const mondayFor = (value) => {
  const dayStart = startOfUtcDay(value);
  const isoDay = dayStart.getUTCDay() === 0 ? 7 : dayStart.getUTCDay();

  return addDays(dayStart, 1 - isoDay);
};

const buildInviteUrl = (inviteToken, membershipRole) => {
  const baseOrigin =
    env.frontendOrigins?.[0]
      ?? env.FRONTEND_APP_ORIGIN.split(",").map((value) => value.trim()).find(Boolean)
      ?? "https://tasktrail.site";
  const inviteUrl = `${baseOrigin}/#/join?inviteToken=${encodeURIComponent(inviteToken)}`;

  if (membershipRole === TEAM_MEMBERSHIP_ROLES.MANAGER) {
    return `${inviteUrl}&membershipRole=${encodeURIComponent(membershipRole)}`;
  }

  return inviteUrl;
};

const generateJoinCode = (length = 8) =>
  Array.from(crypto.randomBytes(length))
    .map((value) => JOIN_CODE_ALPHABET[value % JOIN_CODE_ALPHABET.length])
    .join("");

const generateInviteToken = () => crypto.randomBytes(24).toString("base64url");

const deleteExistingTeamByName = async (teamName, client) => {
  const existingTeamResult = await client.query(
    `
      select id
      from public.teams
      where name = $1
    `,
    [teamName]
  );

  const existingTeamId = existingTeamResult.rows[0]?.id ?? null;

  if (!existingTeamId) {
    return;
  }

  await client.query(`delete from public.notifications where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.team_access_tokens where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.team_membership_events where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.goals where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.hours_logged where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.tasks where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.recurring_task_rules where team_id = $1`, [existingTeamId]);
  await client.query(`delete from public.teams where id = $1`, [existingTeamId]);
};

const findDemoUsersByKey = async () => {
  const usersByKey = new Map();

  for (const user of DEMO_USERS) {
    const profile = await findUserAccessProfileByEmail(user.email);

    if (!profile) {
      throw new Error(
        `Missing demo account ${user.email}. Run \`npm run seed:demo-users\` before seeding the demo group.`
      );
    }

    usersByKey.set(user.key, profile);
  }

  return usersByKey;
};

const ensureJoinAccessPair = async (
  teamId,
  grantedMembershipRole,
  createdByUserId,
  client
) => {
  await revokeActiveTeamAccessTokens(
    {
      teamId,
      grantedMembershipRole
    },
    { pool: client }
  );

  const joinCode = generateJoinCode();
  const inviteToken = generateInviteToken();

  await createTeamAccessToken(
    {
      teamId,
      tokenType: TEAM_ACCESS_TOKEN_TYPES.JOIN_CODE,
      grantedMembershipRole,
      tokenValue: joinCode,
      createdByUserId
    },
    { pool: client }
  );

  await createTeamAccessToken(
    {
      teamId,
      tokenType: TEAM_ACCESS_TOKEN_TYPES.INVITE_LINK,
      grantedMembershipRole,
      tokenValue: inviteToken,
      createdByUserId
    },
    { pool: client }
  );

  return {
    membershipRole: grantedMembershipRole,
    joinCode,
    inviteToken,
    inviteUrl: buildInviteUrl(inviteToken, grantedMembershipRole)
  };
};

const createGeneratedRecurringTask = async (
  recurringRuleId,
  blueprint,
  teamId,
  managerId,
  assigneeUserId,
  generatedForDate,
  client
) => {
  const dueTimeParts = blueprint.dueTime.split(":").map(Number);
  const dueAt = setUtcTime(
    generatedForDate,
    dueTimeParts[0] ?? 9,
    dueTimeParts[1] ?? 0
  ).toISOString();
  const taskId = await createTask(
    {
      teamId,
      title: blueprint.title,
      description: blueprint.description,
      notes:
        blueprint.generatedTaskNotes
        ?? "Generated from the recurring schedule for demo visibility.",
      status: blueprint.generatedTaskStatus ?? TASK_STATUSES.TODO,
      priority: blueprint.priority,
      dueAt,
      weekStartDate: formatDate(mondayFor(generatedForDate)),
      recurringRuleId,
      generatedForDate: formatDate(generatedForDate),
      estimatedHours: 1.25,
      progressPercent: blueprint.generatedTaskProgressPercent ?? 0,
      createdByUserId: managerId,
      updatedByUserId: managerId
    },
    { pool: client }
  );

  if (assigneeUserId) {
    await createTaskAssignment(
      {
        taskId,
        assigneeUserId,
        assignedByUserId: managerId,
        assignmentNote: "Generated from the recurring schedule."
      },
      { pool: client }
    );
  }

  await createTaskUpdate(
    {
      taskId,
      updatedByUserId: managerId,
      updateType: "created",
      statusAfter: blueprint.generatedTaskStatus ?? TASK_STATUSES.TODO,
      progressPercentAfter: blueprint.generatedTaskProgressPercent ?? 0,
      note: blueprint.generatedTaskNotes ?? "Generated recurring task instance.",
      assigneeUserId: assigneeUserId ?? null
    },
    { pool: client }
  );
};

export const seedDemoGroup = async () => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const usersByKey = await findDemoUsersByKey();
    const manager = usersByKey.get(DEMO_LOGIN_ACCOUNTS.manager.key);
    const employeeOne = usersByKey.get(DEMO_LOGIN_ACCOUNTS.employee.key);
    const employeeTwo = usersByKey.get("employeeTwo");
    await deleteExistingTeamByName(DEMO_TEAM.name, client);

    const team = await upsertTeam(
      {
        name: DEMO_TEAM.name,
        description: DEMO_TEAM.description
      },
      { pool: client }
    );

    for (const userKey of DEMO_PRIMARY_TEAM_MEMBER_KEYS) {
      const fixture = DEMO_USERS.find((user) => user.key === userKey);
      const user = usersByKey.get(userKey);

      await upsertTeamMember(
        {
          teamId: team.id,
          userId: user.id,
          membershipRole: fixture.membershipRole
        },
        { pool: client }
      );
    }

    const today = startOfUtcDay();
    const taskIdsByKey = new Map();

    for (const blueprint of DEMO_TASK_BLUEPRINTS) {
      const dueDate = setUtcTime(
        addDays(today, blueprint.dueDaysFromToday),
        blueprint.dueHourUtc
      );
      const completedAt = blueprint.completedDaysFromToday === undefined
        ? null
        : setUtcTime(
            addDays(today, blueprint.completedDaysFromToday),
            blueprint.completedHourUtc ?? blueprint.dueHourUtc
          ).toISOString();
      const assignee = blueprint.assigneeKey
        ? usersByKey.get(blueprint.assigneeKey)
        : null;
      const taskId = await createTask(
        {
          teamId: team.id,
          title: blueprint.title,
          description: blueprint.description,
          notes: blueprint.notes,
          status: blueprint.status,
          priority: blueprint.priority,
          dueAt: dueDate.toISOString(),
          weekStartDate: formatDate(mondayFor(dueDate)),
          estimatedHours: blueprint.estimatedHours,
          progressPercent: blueprint.progressPercent,
          createdByUserId: manager.id,
          updatedByUserId: manager.id,
          completedAt
        },
        { pool: client }
      );

      if (assignee) {
        await createTaskAssignment(
          {
            taskId,
            assigneeUserId: assignee.id,
            assignedByUserId: manager.id,
            assignmentNote: blueprint.assignmentNote ?? null
          },
          { pool: client }
        );
      }

      await createTaskUpdate(
        {
          taskId,
          updatedByUserId: manager.id,
          updateType: "created",
          statusAfter: blueprint.status,
          progressPercentAfter: blueprint.progressPercent,
          note: blueprint.notes,
          assigneeUserId: assignee?.id ?? null
        },
        { pool: client }
      );

      taskIdsByKey.set(blueprint.key, taskId);
    }

    const recurringRules = [];

    for (const blueprint of DEMO_RECURRING_RULE_BLUEPRINTS) {
      const assignee = blueprint.defaultAssigneeKey
        ? usersByKey.get(blueprint.defaultAssigneeKey)
        : null;
      const ruleId = await createRecurringTaskRule(
        {
          teamId: team.id,
          title: blueprint.title,
          description: blueprint.description,
          priority: blueprint.priority,
          defaultAssigneeUserId: assignee?.id ?? null,
          frequency: blueprint.frequency,
          weekdays: blueprint.weekdays ?? null,
          dayOfMonth: blueprint.dayOfMonth ?? null,
          dueTime: blueprint.dueTime,
          startsOn: formatDate(addDays(today, blueprint.startsOnOffsetDays)),
          endsOn: blueprint.endsOnOffsetDays === undefined
            ? null
            : formatDate(addDays(today, blueprint.endsOnOffsetDays)),
          createdByUserId: manager.id,
          updatedByUserId: manager.id
        },
        { pool: client }
      );

      const generatedForDate = (() => {
        if (blueprint.frequency === "daily") {
          return addDays(today, 1);
        }

        if (blueprint.frequency === "weekly") {
          const weekday = blueprint.weekdays[0] ?? 1;
          const currentWeekday = today.getUTCDay();
          const rawDelta = (weekday - currentWeekday + 7) % 7;
          const delta = rawDelta === 0 ? 7 : rawDelta;

          return addDays(today, delta);
        }

        const next = new Date(today);
        next.setUTCDate(blueprint.dayOfMonth);
        if (next < today) {
          next.setUTCMonth(next.getUTCMonth() + 1);
        }
        return next;
      })();

      recurringRules.push({
        id: ruleId,
        title: blueprint.title,
        frequency: blueprint.frequency
      });

      await createGeneratedRecurringTask(
        ruleId,
        blueprint,
        team.id,
        manager.id,
        assignee?.id ?? null,
        generatedForDate,
        client
      );
    }

    const employeeJoinAccess = await ensureJoinAccessPair(
      team.id,
      TEAM_MEMBERSHIP_ROLES.MEMBER,
      manager.id,
      client
    );
    const managerJoinAccess = await ensureJoinAccessPair(
      team.id,
      TEAM_MEMBERSHIP_ROLES.MANAGER,
      manager.id,
      client
    );

    await client.query("commit");

    return {
      team,
      recurringRules,
      employeeJoinAccess,
      managerJoinAccess,
      accounts: {
        manager: manager.email,
        employeeOne: employeeOne.email,
        employeeTwo: employeeTwo.email,
        employeeJoin: DEMO_LOGIN_ACCOUNTS.employeeJoin.email,
        managerJoin: DEMO_LOGIN_ACCOUNTS.managerJoin.email
      },
      taskIds: Object.fromEntries(taskIdsByKey)
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const main = async () => {
  const seeded = await seedDemoGroup();

  console.log(`Clean demo team ready: ${seeded.team.name}`);
  console.log(`Manager account: ${seeded.accounts.manager}`);
  console.log(`Employee account: ${seeded.accounts.employeeOne}`);
  console.log(`Secondary employee: ${seeded.accounts.employeeTwo}`);
  console.log(`Join-flow employee: ${seeded.accounts.employeeJoin}`);
  console.log(`Manager-invite account: ${seeded.accounts.managerJoin}`);
  console.log(`Employee join code: ${seeded.employeeJoinAccess.joinCode}`);
  console.log(`Employee invite URL: ${seeded.employeeJoinAccess.inviteUrl}`);
  console.log(`Manager join code: ${seeded.managerJoinAccess.joinCode}`);
  console.log(`Manager invite URL: ${seeded.managerJoinAccess.inviteUrl}`);
};

const invokedPath = process.argv[1]
  ? new URL(`file://${process.argv[1]}`).href
  : null;

if (invokedPath === import.meta.url) {
  main()
    .catch((error) => {
      console.error("Failed to seed the clean demo group.", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
