import "dotenv/config";
import { env } from "../src/config/env.js";
import { getServiceRoleSupabaseClient } from "../src/config/supabase.js";
import { closePool } from "../src/db/pool.js";
import { upsertUserProfile } from "../src/repositories/user.repository.js";
import { DEMO_USERS } from "./demo-fixture.js";

const demoPassword = env.DEMO_USER_PASSWORD;

if (!demoPassword) {
  throw new Error(
    "DEMO_USER_PASSWORD must be set in the local environment before seeding demo users."
  );
}

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

const findExistingAuthUser = async (supabaseClient, email) => {
  const users = await listAllAuthUsers(supabaseClient);

  return (
    users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
  );
};

const createOrUpdateAuthUser = async (supabaseClient, user) => {
  const existingUser = await findExistingAuthUser(supabaseClient, user.email);

  if (existingUser) {
    const { data, error } = await supabaseClient.auth.admin.updateUserById(
      existingUser.id,
      {
        password: demoPassword,
        email_confirm: true,
        user_metadata: {
          first_name: user.firstName,
          last_name: user.lastName,
          job_title: user.jobTitle
        },
        app_metadata: {
          ...(existingUser.app_metadata ?? {}),
          app_role: user.appRole
        }
      }
    );

    if (error) {
      throw error;
    }

    return data.user ?? data;
  }

  const { data, error } = await supabaseClient.auth.admin.createUser({
    email: user.email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      first_name: user.firstName,
      last_name: user.lastName,
      job_title: user.jobTitle
    },
    app_metadata: {
      app_role: user.appRole
    }
  });

  if (error) {
    throw error;
  }

  return data.user ?? data;
};

export const seedDemoUsers = async () => {
  const supabaseClient = getServiceRoleSupabaseClient();
  const seededUsers = [];

  for (const demoUser of DEMO_USERS) {
    const authUser = await createOrUpdateAuthUser(supabaseClient, demoUser);

    await upsertUserProfile({
      id: authUser.id,
      email: demoUser.email,
      firstName: demoUser.firstName,
      lastName: demoUser.lastName,
      jobTitle: demoUser.jobTitle,
      dateOfBirth: demoUser.dateOfBirth ?? null,
      address: demoUser.address ?? null,
      avatarUrl: null,
      appRole: demoUser.appRole,
      isActive: true
    });

    seededUsers.push({
      key: demoUser.key,
      id: authUser.id,
      email: demoUser.email,
      firstName: demoUser.firstName,
      lastName: demoUser.lastName,
      appRole: demoUser.appRole
    });
  }

  return seededUsers;
};

const main = async () => {
  const users = await seedDemoUsers();

  console.log("Clean demo users are ready:");
  for (const user of users) {
    console.log(`- ${user.firstName} ${user.lastName} <${user.email}> (${user.appRole})`);
  }
};

const invokedPath = process.argv[1]
  ? new URL(`file://${process.argv[1]}`).href
  : null;

if (invokedPath === import.meta.url) {
  main()
    .catch((error) => {
      console.error("Failed to seed demo users.", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePool();
    });
}
