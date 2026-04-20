import "dotenv/config";
import { getServiceRoleSupabaseClient } from "../src/config/supabase.js";
import { closePool, getPool } from "../src/db/pool.js";

const defaultBaseUrl = `http://localhost:${process.env.PORT ?? "4000"}`;
const baseUrl = (process.env.DEEP_AUDIT_BASE_URL ?? defaultBaseUrl).replace(/\/$/, "");
const apiPrefixInput = process.env.API_PREFIX ?? "/api/v1";
const apiPrefix = apiPrefixInput.startsWith("/") ? apiPrefixInput : `/${apiPrefixInput}`;
const apiBaseUrl = `${baseUrl}${apiPrefix}`;

const demoPassword = process.env.DEMO_USER_PASSWORD;
const tempAdminEmail = "qa.admin.temp@tasktrail.local";
const tempAdminPassword = process.env.DEEP_AUDIT_TEMP_ADMIN_PASSWORD ?? demoPassword;
const demoGroupName = "Northstar Operations";

if (!demoPassword) {
  throw new Error("DEMO_USER_PASSWORD is required to run the deep audit.");
}

if (!tempAdminPassword) {
  throw new Error(
    "DEEP_AUDIT_TEMP_ADMIN_PASSWORD or DEMO_USER_PASSWORD is required to run the deep audit."
  );
}

const supabase = getServiceRoleSupabaseClient();
const pool = getPool();

let checksPassed = 0;
const tempTaskIds = new Set();
const tempHoursLogIds = new Set();

const assertCheck = (condition, label, context = "") => {
  if (!condition) {
    const suffix = context ? ` (${context})` : "";
    throw new Error(`${label}${suffix}`);
  }

  checksPassed += 1;
  console.log(`PASS ${label}`);
};

const parseJson = async (response, label) => {
  try {
    return await response.json();
  } catch (_error) {
    throw new Error(`${label} returned a non-JSON response.`);
  }
};

const requestJson = async (path, options = {}) => {
  const targetUrl = `${apiBaseUrl}${path}`;
  const { headers = {}, ...restOptions } = options;
  const response = await fetch(targetUrl, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
  const body = await parseJson(response, path);

  return { response, body };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (label, check, { timeoutMs = 8000, intervalMs = 250 } = {}) => {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const result = await check();

      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(intervalMs);
  }

  const details = lastError ? ` (${lastError.message})` : "";
  throw new Error(`${label}${details}`);
};

const weekMonday = () => {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const isoDay = dayStart.getUTCDay() === 0 ? 7 : dayStart.getUTCDay();

  dayStart.setUTCDate(dayStart.getUTCDate() + 1 - isoDay);

  return dayStart.toISOString().slice(0, 10);
};

const listAuthUsers = async () => {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    throw error;
  }

  return data.users;
};

const findAuthUserByEmail = async (email) => {
  const users = await listAuthUsers();

  return (
    users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
  );
};

const deleteAuthUserIfExists = async (email) => {
  const user = await findAuthUserByEmail(email);

  if (!user) {
    return;
  }

  const { error } = await supabase.auth.admin.deleteUser(user.id);

  if (error) {
    throw error;
  }
};

const getProfileById = async (userId) => {
  const result = await pool.query(
    `
      select
        id,
        email,
        first_name,
        last_name,
        job_title,
        app_role
      from public.users
      where id = $1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
};

const getUserByEmail = async (email) => {
  const result = await pool.query(
    `
      select
        id,
        email,
        first_name,
        last_name,
        job_title,
        app_role
      from public.users
      where lower(email) = lower($1)
    `,
    [email]
  );

  return result.rows[0] ?? null;
};

const getTeamByName = async (teamName) => {
  const result = await pool.query(
    `
      select id, name
      from public.teams
      where name = $1
    `,
    [teamName]
  );

  return result.rows[0] ?? null;
};

const login = async (email, password) => {
  const result = await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password
    })
  });

  assertCheck(result.response.status === 200, `login succeeds for ${email}`);

  const accessToken = result.body.data?.session?.accessToken;

  assertCheck(
    typeof accessToken === "string" && accessToken.length > 0,
    `access token is returned for ${email}`
  );

  return {
    token: accessToken,
    user: result.body.data.user
  };
};

const run = async () => {
  const health = await requestJson("/health", { method: "GET" });
  assertCheck(health.response.status === 200, "health endpoint succeeds before audit");
  assertCheck(
    health.body.data?.database?.status === "connected",
    "health endpoint reports connected database"
  );

  await deleteAuthUserIfExists(tempAdminEmail);

  const createTempUser = await supabase.auth.admin.createUser({
    email: tempAdminEmail,
    password: tempAdminPassword,
    email_confirm: true,
    user_metadata: {
      first_name: "Quinn",
      last_name: "Admin",
      job_title: "QA Analyst"
    },
    app_metadata: {
      app_role: "employee"
    }
  });

  if (createTempUser.error) {
    throw createTempUser.error;
  }

  const tempAdminId = createTempUser.data.user.id;

  const initialProfile = await waitFor(
    "new auth user profile appears in public.users",
    async () => {
      const profile = await getProfileById(tempAdminId);
      return profile?.app_role === "employee" ? profile : null;
    }
  );

  assertCheck(initialProfile.app_role === "employee", "new auth user sync defaults to employee profile role");
  assertCheck(initialProfile.job_title === "QA Analyst", "new auth user sync copies the initial job title");

  const updateTempUser = await supabase.auth.admin.updateUserById(tempAdminId, {
    user_metadata: {
      first_name: "Quinn",
      last_name: "Admin",
      job_title: "QA Administrator"
    },
    app_metadata: {
      app_role: "admin"
    }
  });

  if (updateTempUser.error) {
    throw updateTempUser.error;
  }

  const syncedAdminProfile = await waitFor(
    "updated auth user syncs admin role into public.users",
    async () => {
      const profile = await getProfileById(tempAdminId);

      return profile?.app_role === "admin" && profile.job_title === "QA Administrator"
        ? profile
        : null;
    }
  );

  assertCheck(syncedAdminProfile.app_role === "admin", "updated auth user syncs admin role into public.users");
  assertCheck(
    syncedAdminProfile.job_title === "QA Administrator",
    "updated auth user syncs job title changes into public.users"
  );

  const demoTeam = await getTeamByName(demoGroupName);
  assertCheck(Boolean(demoTeam), "Northstar Operations exists for deep audit");

  const manager = await getUserByEmail("olivia.hart@tasktrail.local");
  const employeeOne = await getUserByEmail("ethan.reyes@tasktrail.local");
  const employeeTwo = await getUserByEmail("priya.shah@tasktrail.local");

  assertCheck(Boolean(manager), "demo manager exists");
  assertCheck(Boolean(employeeOne), "demo employee one exists");
  assertCheck(Boolean(employeeTwo), "demo employee two exists");

  const adminLogin = await login(tempAdminEmail, tempAdminPassword);
  assertCheck(adminLogin.user.appRole === "admin", "temp admin login resolves with admin app role");

  const managerLogin = await login("olivia.hart@tasktrail.local", demoPassword);
  assertCheck(managerLogin.user.appRole === "manager", "manager demo login resolves with manager app role");

  const employeeLogin = await login("ethan.reyes@tasktrail.local", demoPassword);
  assertCheck(employeeLogin.user.appRole === "employee", "employee demo login resolves with employee app role");

  const adminManagerAccess = await requestJson("/auth/manager-access", {
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    }
  });
  assertCheck(adminManagerAccess.response.status === 200, "admin passes manager-access RBAC check");

  const adminTeams = await requestJson("/teams", {
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    }
  });
  assertCheck(adminTeams.response.status === 200, "admin can list teams");
  assertCheck(
    adminTeams.body.data.teams.some((team) => team.name === demoGroupName),
    "admin can see Northstar Operations without membership"
  );

  const adminMembers = await requestJson(`/teams/${demoTeam.id}/members`, {
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    }
  });
  assertCheck(adminMembers.response.status === 200, "admin can view team members without membership");
  assertCheck(
    adminMembers.body.data.members.some((member) => member.id === employeeOne.id),
    "admin team roster includes employee one"
  );

  const adminTask = await requestJson("/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      teamId: demoTeam.id,
      title: `[ADMIN-AUDIT] cross-team task ${Date.now()}`,
      weekStartDate: weekMonday(),
      priority: "high"
    })
  });
  assertCheck(adminTask.response.status === 201, "admin can create a task for a team they do not belong to");
  tempTaskIds.add(adminTask.body.data.task.id);

  const adminAssign = await requestJson("/task-assignments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    },
    body: JSON.stringify({
      taskId: adminTask.body.data.task.id,
      assigneeUserId: employeeOne.id,
      assignmentNote: "deep audit cross-team assignment"
    })
  });
  assertCheck(adminAssign.response.status === 201, "admin can assign a task without team membership");

  const employeeTasks = await requestJson("/tasks", {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    }
  });
  assertCheck(employeeTasks.response.status === 200, "employee task list still loads during deep audit");
  assertCheck(
    employeeTasks.body.data.tasks.some((task) => task.id === adminTask.body.data.task.id),
    "employee receives the admin-assigned task in their task list"
  );

  const managerDashboard = await requestJson("/dashboards/manager", {
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    }
  });
  assertCheck(managerDashboard.response.status === 200, "manager dashboard still loads");

  const employeeDashboard = await requestJson("/dashboards/employee", {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    }
  });
  assertCheck(employeeDashboard.response.status === 200, "employee dashboard still loads");

  const productivityTeam = await requestJson(
    `/productivity-metrics?scope=team&teamId=${demoTeam.id}`,
    {
      headers: {
        Authorization: `Bearer ${managerLogin.token}`
      }
    }
  );
  assertCheck(productivityTeam.response.status === 200, "manager productivity team rollup still loads");

  const mixedGoals = await requestJson(`/goals?teamId=${demoTeam.id}`, {
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    }
  });
  assertCheck(mixedGoals.response.status === 200, "manager goals list still loads");
  assertCheck(
    mixedGoals.body.data.summary?.hasMixedUnits === true,
    "mixed-unit goal summary reports mixed units"
  );
  assertCheck(
    mixedGoals.body.data.summary?.totalTargetValue === null &&
      mixedGoals.body.data.summary?.totalActualValue === null,
    "mixed-unit goal summary nulls combined totals"
  );
  assertCheck(
    Array.isArray(mixedGoals.body.data.summary?.totalsByUnit) &&
      mixedGoals.body.data.summary.totalsByUnit.length >= 2,
    "mixed-unit goal summary includes grouped totals by unit"
  );

  const integrityTask = await requestJson("/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    },
    body: JSON.stringify({
      teamId: demoTeam.id,
      title: `[INTEGRITY-AUDIT] delete keeps hours ${Date.now()}`,
      weekStartDate: weekMonday(),
      priority: "medium"
    })
  });
  assertCheck(integrityTask.response.status === 201, "manager can create integrity audit task");
  tempTaskIds.add(integrityTask.body.data.task.id);

  const integrityAssign = await requestJson("/task-assignments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    },
    body: JSON.stringify({
      taskId: integrityTask.body.data.task.id,
      assigneeUserId: employeeOne.id,
      assignmentNote: "deep audit hours integrity"
    })
  });
  assertCheck(integrityAssign.response.status === 201, "manager can assign integrity audit task");

  const hoursCreate = await requestJson("/hours-logged", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    },
    body: JSON.stringify({
      teamId: demoTeam.id,
      taskId: integrityTask.body.data.task.id,
      workDate: new Date().toISOString().slice(0, 10),
      hours: 1.5,
      note: `[INTEGRITY-AUDIT] delete keeps hours ${Date.now()}`
    })
  });
  assertCheck(hoursCreate.response.status === 201, "employee can log hours on integrity audit task");
  tempHoursLogIds.add(hoursCreate.body.data.hoursLog.id);

  const deleteIntegrityTask = await requestJson(`/tasks/${integrityTask.body.data.task.id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    }
  });
  assertCheck(deleteIntegrityTask.response.status === 200, "manager can delete a task that has hours logs");
  tempTaskIds.delete(integrityTask.body.data.task.id);

  const hoursRowAfterDelete = await waitFor(
    "deleted task nulls task_id on existing hours logs",
    async () => {
      const result = await pool.query(
        `
          select task_id
          from public.hours_logged
          where id = $1
        `,
        [hoursCreate.body.data.hoursLog.id]
      );

      return result.rows[0]?.task_id === null ? result.rows[0] : null;
    }
  );
  assertCheck(hoursRowAfterDelete.task_id === null, "task deletion preserves the hours log with a null task_id");

  const employeeHours = await requestJson("/hours-logged", {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    }
  });
  assertCheck(employeeHours.response.status === 200, "employee hours list still loads after task deletion");
  assertCheck(
    employeeHours.body.data.hoursLogs.some(
      (entry) => entry.id === hoursCreate.body.data.hoursLog.id && entry.taskId === null
    ),
    "employee sees deleted-task hours entry with taskId null"
  );

  const raceTask = await requestJson("/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managerLogin.token}`
    },
    body: JSON.stringify({
      teamId: demoTeam.id,
      title: `[RACE-AUDIT] concurrent assignment ${Date.now()}`,
      weekStartDate: weekMonday()
    })
  });
  assertCheck(raceTask.response.status === 201, "manager can create concurrent-assignment audit task");
  tempTaskIds.add(raceTask.body.data.task.id);

  const [assignOne, assignTwo] = await Promise.all([
    requestJson("/task-assignments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerLogin.token}`
      },
      body: JSON.stringify({
        taskId: raceTask.body.data.task.id,
        assigneeUserId: employeeOne.id,
        assignmentNote: "deep audit race one"
      })
    }),
    requestJson("/task-assignments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managerLogin.token}`
      },
      body: JSON.stringify({
        taskId: raceTask.body.data.task.id,
        assigneeUserId: employeeTwo.id,
        assignmentNote: "deep audit race two"
      })
    })
  ]);
  const raceStatuses = [assignOne.response.status, assignTwo.response.status];
  assertCheck(
    raceStatuses.every((status) => status >= 200 && status < 500),
    "concurrent assignment requests avoid 5xx failures",
    `statuses=${raceStatuses.join(",")}`
  );

  const activeAssignmentCount = await pool.query(
    `
      select count(*)::int as active_count
      from public.task_assignments
      where task_id = $1
        and is_active = true
    `,
    [raceTask.body.data.task.id]
  );
  assertCheck(
    activeAssignmentCount.rows[0].active_count === 1,
    "concurrent assignment leaves exactly one active assignment"
  );

  console.log(`Deep audit passed: ${checksPassed}/${checksPassed} checks.`);
};

run()
  .catch((error) => {
    console.error(`Deep audit failed after ${checksPassed} successful checks.`);
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (tempHoursLogIds.size > 0) {
      await pool.query(
        `
          delete from public.hours_logged
          where id = any($1::uuid[])
        `,
        [Array.from(tempHoursLogIds)]
      );
    }

    if (tempTaskIds.size > 0) {
      await pool.query(
        `
          delete from public.tasks
          where id = any($1::uuid[])
        `,
        [Array.from(tempTaskIds)]
      );
    }

    await deleteAuthUserIfExists(tempAdminEmail);
    await closePool();
  });
