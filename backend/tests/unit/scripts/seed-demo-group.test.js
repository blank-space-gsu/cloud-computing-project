import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_LOGIN_ACCOUNTS, DEMO_TEAM, DEMO_USERS } from "../../../scripts/demo-fixture.js";

const {
  getPool,
  closePool,
  createRecurringTaskRule,
  createTask,
  createTaskAssignment,
  createTaskUpdate,
  createTeamAccessToken,
  revokeActiveTeamAccessTokens,
  createTeamRecord,
  upsertTeamMember,
  findUserAccessProfileByEmail
} = vi.hoisted(() => ({
  getPool: vi.fn(),
  closePool: vi.fn(),
  createRecurringTaskRule: vi.fn(),
  createTask: vi.fn(),
  createTaskAssignment: vi.fn(),
  createTaskUpdate: vi.fn(),
  createTeamAccessToken: vi.fn(),
  revokeActiveTeamAccessTokens: vi.fn(),
  createTeamRecord: vi.fn(),
  upsertTeamMember: vi.fn(),
  findUserAccessProfileByEmail: vi.fn()
}));

vi.mock("../../../src/config/env.js", () => ({
  env: {
    FRONTEND_APP_ORIGIN: "https://tasktrail.site",
    frontendOrigins: ["https://tasktrail.site"]
  }
}));

vi.mock("../../../src/db/pool.js", () => ({
  closePool,
  getPool
}));

vi.mock("../../../src/repositories/recurringTaskRule.repository.js", () => ({
  createRecurringTaskRule
}));

vi.mock("../../../src/repositories/task.repository.js", () => ({
  createTask,
  createTaskAssignment,
  createTaskUpdate
}));

vi.mock("../../../src/repositories/team.repository.js", () => ({
  createTeamAccessToken,
  createTeamRecord,
  revokeActiveTeamAccessTokens,
  upsertTeamMember
}));

vi.mock("../../../src/repositories/user.repository.js", () => ({
  findUserAccessProfileByEmail
}));

const { seedDemoGroup } = await import("../../../scripts/seed-demo-group.js");

describe("seed demo group script", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const client = {
      query: vi.fn(async (sql) => {
        if (typeof sql === "string" && sql.includes("select id") && sql.includes("from public.teams")) {
          return {
            rows: [{ id: "team-old-1" }, { id: "team-old-2" }]
          };
        }

        return { rows: [] };
      }),
      release: vi.fn()
    };

    getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client)
    });

    createTeamRecord.mockResolvedValue("team-new");
    upsertTeamMember.mockResolvedValue({});
    createTask.mockResolvedValue("task-1");
    createTaskAssignment.mockResolvedValue({});
    createTaskUpdate.mockResolvedValue({});
    createRecurringTaskRule.mockResolvedValue("rule-1");
    revokeActiveTeamAccessTokens.mockResolvedValue(undefined);
    createTeamAccessToken.mockResolvedValue({});

    findUserAccessProfileByEmail.mockImplementation(async (email) => {
      const fixture = DEMO_USERS.find((user) => user.email === email);

      return fixture
        ? {
            id: `${fixture.key}-id`,
            email: fixture.email
          }
        : null;
    });
  });

  it("recreates the demo team with a plain insert after clearing any existing duplicate names", async () => {
    const result = await seedDemoGroup();
    const pool = getPool.mock.results[0].value;
    const connectCall = await pool.connect.mock.results[0].value;

    expect(createTeamRecord).toHaveBeenCalledWith(
      {
        name: DEMO_TEAM.name,
        description: DEMO_TEAM.description
      },
      { pool: connectCall }
    );
    expect(connectCall.query).toHaveBeenCalledWith(
      expect.stringContaining("delete from public.teams where id = any($1::uuid[])"),
      [["team-old-1", "team-old-2"]]
    );
    expect(result.team).toEqual({
      id: "team-new",
      name: DEMO_TEAM.name,
      description: DEMO_TEAM.description
    });
    expect(result.accounts.manager).toBe(DEMO_LOGIN_ACCOUNTS.manager.email);
  });
});
