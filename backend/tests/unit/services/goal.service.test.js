import { describe, expect, it, vi } from "vitest";
import {
  createGoalForUser,
  listGoalsForUser,
  updateGoalForUser
} from "../../../src/services/goal.service.js";

const employeeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "employee"
};

const managerUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "manager"
};

describe("goal service", () => {
  it("limits employee goal listings to their own relevant goals", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Operations",
        canManageTeam: false
      }
    ]);
    const loadGoals = vi.fn().mockResolvedValue({
      goals: [],
      total: 0,
      summary: {
        totalGoalCount: 0
      },
      charts: {
        byStatus: []
      }
    });

    await listGoalsForUser(
      employeeUser,
      {
        userId: "33333333-3333-4333-8333-333333333333"
      },
      {
        listTeams,
        loadGoals
      }
    );

    expect(loadGoals).toHaveBeenCalledWith({
      teamIds: ["team-1"],
      viewerUserId: employeeUser.id,
      onlyViewerRelevant: true,
      filters: expect.objectContaining({
        userId: undefined
      })
    });
  });

  it("filters manager goal listings to an accessible user", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Operations",
        canManageTeam: true
      },
      {
        id: "team-2",
        name: "Support",
        canManageTeam: true
      }
    ]);
    const findUser = vi.fn().mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      isActive: true,
      teams: [
        {
          teamId: "team-2"
        }
      ]
    });
    const loadGoals = vi.fn().mockResolvedValue({
      goals: [],
      total: 0,
      summary: {
        totalGoalCount: 0
      },
      charts: {
        byStatus: []
      }
    });

    const result = await listGoalsForUser(
      managerUser,
      {
        userId: "33333333-3333-4333-8333-333333333333"
      },
      {
        listTeams,
        findUser,
        loadGoals
      }
    );

    expect(loadGoals).toHaveBeenCalledWith({
      teamIds: ["team-2"],
      filters: expect.objectContaining({
        userId: "33333333-3333-4333-8333-333333333333"
      })
    });
    expect(result.selectedUserId).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("creates a user-scoped goal for an employee target", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: "team-1",
      membershipRole: "manager"
    });
    const findTeamMemberUser = vi.fn().mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      isActive: true,
      appRole: "employee"
    });
    const insertGoal = vi.fn().mockResolvedValue("goal-1");
    const findGoal = vi.fn().mockResolvedValue({
      id: "goal-1",
      scope: "user"
    });

    const result = await createGoalForUser(
      managerUser,
      {
        teamId: "team-1",
        targetUserId: "33333333-3333-4333-8333-333333333333",
        title: "March sales target",
        scope: "user",
        goalType: "sales_quota",
        period: "monthly",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        targetValue: 15000,
        actualValue: 0,
        unit: "USD",
        status: "active"
      },
      {
        findTeam,
        findTeamMemberUser,
        insertGoal,
        findGoal
      }
    );

    expect(insertGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        targetUserId: "33333333-3333-4333-8333-333333333333",
        createdByUserId: managerUser.id
      })
    );
    expect(result.id).toBe("goal-1");
  });

  it("rejects goal creation when the target is not an employee", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: "team-1",
      membershipRole: "manager"
    });
    const findTeamMemberUser = vi.fn().mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      isActive: true,
      appRole: "manager"
    });

    await expect(
      createGoalForUser(
        managerUser,
        {
          teamId: "team-1",
          targetUserId: "33333333-3333-4333-8333-333333333333",
          title: "March sales target",
          scope: "user",
          goalType: "sales_quota",
          period: "monthly",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
          targetValue: 15000,
          actualValue: 0,
          unit: "USD",
          status: "active"
        },
        {
          findTeam,
          findTeamMemberUser
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_GOAL_TARGET_ROLE"
    });
  });

  it("rejects updates when a goal is not manageable", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Operations",
        canManageTeam: true
      }
    ]);
    const findGoal = vi.fn().mockResolvedValue(null);

    await expect(
      updateGoalForUser(
        managerUser,
        "goal-1",
        {
          actualValue: 12000
        },
        {
          listTeams,
          findGoal
        }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "GOAL_NOT_FOUND"
    });
  });
});
