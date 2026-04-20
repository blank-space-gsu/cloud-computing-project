import "dotenv/config";
import { getServiceRoleSupabaseClient } from "../src/config/supabase.js";
import { closePool, getPool } from "../src/db/pool.js";
import { DEMO_TEAM } from "./demo-fixture.js";
import { seedDemoGroup } from "./seed-demo-group.js";
import { seedDemoUsers } from "./seed-demo-users.js";

const USER_EMAIL_PATTERNS = [
  "%@cloudcomputing.local",
  "%@deltajohnsons.com",
  "%@example.com",
  "%@tasktrail.local"
];

const TEAM_NAME_PATTERNS = [
  "Physical Demo Group",
  "Operations Team",
  "Backdrop Check %",
  "Backdrop Team %",
  "QA %",
  DEMO_TEAM.name
];

const listAllAuthUsers = async (supabaseClient) => {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabaseClient.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw error;
    }

    const pageUsers = data?.users ?? [];

    users.push(...pageUsers);

    if (pageUsers.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
};

const findTargetAuthUsers = async (supabaseClient) => {
  const authUsers = await listAllAuthUsers(supabaseClient);

  return authUsers.filter((user) =>
    USER_EMAIL_PATTERNS.some((pattern) => {
      const regex = new RegExp(
        `^${pattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*")
          .replace(/_/g, ".")}$`,
        "i"
      );

      return regex.test(user.email ?? "");
    })
  );
};

const deleteTeamsByPattern = async (client) => {
  const teamsResult = await client.query(
    `
      select id, name
      from public.teams
      where name ilike any($1::text[])
    `,
    [TEAM_NAME_PATTERNS]
  );

  const teamIds = teamsResult.rows.map((row) => row.id);

  if (!teamIds.length) {
    return [];
  }

  await client.query(`delete from public.notifications where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.team_access_tokens where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.team_membership_events where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.goals where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.hours_logged where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.tasks where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.recurring_task_rules where team_id = any($1::uuid[])`, [teamIds]);
  await client.query(`delete from public.teams where id = any($1::uuid[])`, [teamIds]);

  return teamsResult.rows.map((row) => row.name);
};

const deleteUserOwnedArtifacts = async (client, userIds) => {
  if (!userIds.length) {
    return;
  }

  await client.query(`delete from public.notifications where user_id = any($1::uuid[])`, [userIds]);
  await client.query(
    `
      delete from public.team_membership_events
      where user_id = any($1::uuid[])
        or acted_by_user_id = any($1::uuid[])
    `,
    [userIds]
  );
  await client.query(
    `
      delete from public.goals
      where target_user_id = any($1::uuid[])
        or created_by_user_id = any($1::uuid[])
        or updated_by_user_id = any($1::uuid[])
    `,
    [userIds]
  );
  await client.query(`delete from public.hours_logged where user_id = any($1::uuid[])`, [userIds]);
  await client.query(
    `
      delete from public.tasks
      where created_by_user_id = any($1::uuid[])
        or updated_by_user_id = any($1::uuid[])
        or exists (
          select 1
          from public.task_assignments ta
          where ta.task_id = public.tasks.id
            and ta.assignee_user_id = any($1::uuid[])
        )
    `,
    [userIds]
  );
  await client.query(
    `
      delete from public.recurring_task_rules
      where created_by_user_id = any($1::uuid[])
        or updated_by_user_id = any($1::uuid[])
        or default_assignee_user_id = any($1::uuid[])
    `,
    [userIds]
  );
};

const main = async () => {
  const pool = getPool();
  const client = await pool.connect();
  const supabaseClient = getServiceRoleSupabaseClient();

  try {
    const targetAuthUsers = await findTargetAuthUsers(supabaseClient);
    const targetUserIds = targetAuthUsers.map((user) => user.id);

    const deletedTeams = await deleteTeamsByPattern(client);
    await deleteUserOwnedArtifacts(client, targetUserIds);

    const deletedUsers = [];
    for (const user of targetAuthUsers) {
      const { error } = await supabaseClient.auth.admin.deleteUser(user.id);

      if (error) {
        throw error;
      }

      deletedUsers.push(user.email);
    }

    await client.query(
      `
        delete from public.users
        where lower(email) like any($1::text[])
      `,
      [USER_EMAIL_PATTERNS]
    );

    const seededUsers = await seedDemoUsers();
    const seededGroup = await seedDemoGroup();

    console.log("Clean TaskTrail demo environment is ready.");
    console.log(`Removed users: ${deletedUsers.length}`);
    console.log(`Removed teams: ${deletedTeams.length}`);
    console.log("Demo accounts:");
    for (const user of seededUsers) {
      console.log(`- ${user.firstName} ${user.lastName} <${user.email}> (${user.appRole})`);
    }
    console.log(`Team: ${seededGroup.team.name}`);
    console.log(`Employee join code: ${seededGroup.employeeJoinAccess.joinCode}`);
    console.log(`Employee invite URL: ${seededGroup.employeeJoinAccess.inviteUrl}`);
    console.log(`Manager join code: ${seededGroup.managerJoinAccess.joinCode}`);
    console.log(`Manager invite URL: ${seededGroup.managerJoinAccess.inviteUrl}`);
  } catch (error) {
    console.error("Failed to reset the clean demo environment.", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
};

main();
