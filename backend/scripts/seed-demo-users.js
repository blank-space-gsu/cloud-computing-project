import "dotenv/config";
import { env } from "../src/config/env.js";
import { getServiceRoleSupabaseClient } from "../src/config/supabase.js";
import { closePool } from "../src/db/pool.js";
import { upsertTeam, upsertTeamMember } from "../src/repositories/team.repository.js";
import { upsertUserProfile } from "../src/repositories/user.repository.js";

const demoUsers = [
  {
    email: "manager.demo@cloudcomputing.local",
    firstName: "Maya",
    lastName: "Manager",
    jobTitle: "Operations Manager",
    appRole: "manager",
    membershipRole: "manager"
  },
  {
    email: "employee.one@cloudcomputing.local",
    firstName: "Ethan",
    lastName: "Employee",
    jobTitle: "Operations Specialist",
    appRole: "employee",
    membershipRole: "member"
  },
  {
    email: "employee.two@cloudcomputing.local",
    firstName: "Priya",
    lastName: "Employee",
    jobTitle: "Task Coordinator",
    appRole: "employee",
    membershipRole: "member"
  }
];

const demoPassword = env.DEMO_USER_PASSWORD;

if (!demoPassword) {
  throw new Error(
    "DEMO_USER_PASSWORD must be set in the local environment before seeding demo users."
  );
}

const findExistingAuthUser = async (supabaseClient, email) => {
  const { data, error } = await supabaseClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    throw error;
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase()
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

const main = async () => {
  const supabaseClient = getServiceRoleSupabaseClient();
  const team = await upsertTeam({
    name: "Operations Team",
    description: "Demo team for manager and employee authentication checks."
  });

  for (const demoUser of demoUsers) {
    const authUser = await createOrUpdateAuthUser(supabaseClient, demoUser);

    await upsertUserProfile({
      id: authUser.id,
      email: demoUser.email,
      firstName: demoUser.firstName,
      lastName: demoUser.lastName,
      jobTitle: demoUser.jobTitle,
      appRole: demoUser.appRole,
      isActive: true
    });

    await upsertTeamMember({
      teamId: team.id,
      userId: authUser.id,
      membershipRole: demoUser.membershipRole
    });
  }

  console.log("Demo auth users and team membership are ready.");
};

main()
  .catch((error) => {
    console.error("Failed to seed demo users.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
