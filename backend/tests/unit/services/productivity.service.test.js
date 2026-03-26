import { describe, expect, it, vi } from "vitest";
import { getProductivityMetricsForUser } from "../../../src/services/productivity.service.js";

const employeeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "employee"
};

const managerUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "manager"
};

const managerTeams = [
  {
    id: "team-1",
    name: "Operations",
    canManageTeam: true
  },
  {
    id: "team-2",
    name: "Support",
    canManageTeam: false
  }
];

describe("productivity service", () => {
  it("loads employee metrics for the authenticated employee only", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Operations",
        canManageTeam: false
      }
    ]);
    const findUser = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      email: "employee.one@cloudcomputing.local",
      firstName: "Ethan",
      lastName: "Employee",
      fullName: "Ethan Employee",
      jobTitle: "Analyst",
      appRole: "employee",
      isActive: true,
      teams: [
        {
          teamId: "team-1"
        }
      ]
    });
    const loadSnapshot = vi.fn().mockResolvedValue({
      rollups: {
        weekly: {
          taskCount: 1
        }
      },
      charts: {
        weeklyTrend: []
      },
      breakdown: {
        period: {
          name: "monthly"
        },
        members: []
      }
    });

    const result = await getProductivityMetricsForUser(
      employeeUser,
      {
        userId: "33333333-3333-4333-8333-333333333333",
        referenceDate: "2026-03-26"
      },
      {
        listTeams,
        findUser,
        loadSnapshot
      }
    );

    expect(findUser).toHaveBeenCalledWith(employeeUser.id);
    expect(loadSnapshot).toHaveBeenCalledWith({
      teamIds: ["team-1"],
      userId: employeeUser.id,
      ranges: expect.any(Object),
      includeMemberBreakdown: false
    });
    expect(result.scope).toBe("individual");
    expect(result.user.id).toBe(employeeUser.id);
  });

  it("blocks employees from team productivity scope", async () => {
    const listTeams = vi.fn().mockResolvedValue([]);

    await expect(
      getProductivityMetricsForUser(
        employeeUser,
        {
          scope: "team"
        },
        {
          listTeams
        }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PRODUCTIVITY_SCOPE_FORBIDDEN"
    });
  });

  it("loads manager team metrics for manageable teams", async () => {
    const listTeams = vi.fn().mockResolvedValue(managerTeams);
    const loadSnapshot = vi.fn().mockResolvedValue({
      rollups: {
        weekly: {
          taskCount: 4
        }
      },
      charts: {
        weeklyTrend: []
      },
      breakdown: {
        period: {
          name: "monthly"
        },
        members: []
      }
    });

    const result = await getProductivityMetricsForUser(
      managerUser,
      {
        scope: "team",
        referenceDate: "2026-03-26"
      },
      {
        listTeams,
        loadSnapshot
      }
    );

    expect(loadSnapshot).toHaveBeenCalledWith({
      teamIds: ["team-1"],
      ranges: expect.any(Object),
      includeMemberBreakdown: true
    });
    expect(result.scope).toBe("team");
    expect(result.availableTeams).toHaveLength(1);
  });

  it("loads manager individual metrics for accessible users in manageable teams", async () => {
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
      email: "employee.two@cloudcomputing.local",
      firstName: "Erin",
      lastName: "Employee",
      fullName: "Erin Employee",
      jobTitle: "Coordinator",
      appRole: "employee",
      isActive: true,
      teams: [
        {
          teamId: "team-2"
        }
      ]
    });
    const loadSnapshot = vi.fn().mockResolvedValue({
      rollups: {
        weekly: {
          taskCount: 2
        }
      },
      charts: {
        weeklyTrend: []
      },
      breakdown: {
        period: {
          name: "monthly"
        },
        members: []
      }
    });

    const result = await getProductivityMetricsForUser(
      managerUser,
      {
        scope: "individual",
        userId: "33333333-3333-4333-8333-333333333333",
        referenceDate: "2026-03-26"
      },
      {
        listTeams,
        findUser,
        loadSnapshot
      }
    );

    expect(loadSnapshot).toHaveBeenCalledWith({
      teamIds: ["team-2"],
      userId: "33333333-3333-4333-8333-333333333333",
      ranges: expect.any(Object),
      includeMemberBreakdown: false
    });
    expect(result.user.fullName).toBe("Erin Employee");
  });

  it("rejects managers requesting users outside their manageable teams", async () => {
    const listTeams = vi.fn().mockResolvedValue(managerTeams);
    const findUser = vi.fn().mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      email: "employee.two@cloudcomputing.local",
      firstName: "Erin",
      lastName: "Employee",
      fullName: "Erin Employee",
      jobTitle: "Coordinator",
      appRole: "employee",
      isActive: true,
      teams: [
        {
          teamId: "team-9"
        }
      ]
    });

    await expect(
      getProductivityMetricsForUser(
        managerUser,
        {
          scope: "individual",
          userId: "33333333-3333-4333-8333-333333333333"
        },
        {
          listTeams,
          findUser
        }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND"
    });
  });
});
