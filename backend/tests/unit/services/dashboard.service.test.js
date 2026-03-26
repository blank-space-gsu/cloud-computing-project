import { describe, expect, it, vi } from "vitest";
import {
  getEmployeeDashboardForUser,
  getManagerDashboardForUser
} from "../../../src/services/dashboard.service.js";

const employeeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "employee"
};

const managerUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "manager"
};

describe("dashboard service", () => {
  it("loads the employee dashboard for employees", async () => {
    const loadDashboard = vi.fn().mockResolvedValue({
      summary: {
        assignedTaskCount: 2
      },
      charts: {
        byStatus: []
      },
      tasks: {
        upcomingDeadlines: []
      }
    });

    const result = await getEmployeeDashboardForUser(employeeUser, {
      loadDashboard
    });

    expect(loadDashboard).toHaveBeenCalledWith({
      employeeUserId: employeeUser.id
    });
    expect(result.summary.assignedTaskCount).toBe(2);
  });

  it("rejects the employee dashboard for non-employees", async () => {
    await expect(getEmployeeDashboardForUser(managerUser)).rejects.toMatchObject({
      statusCode: 403,
      code: "EMPLOYEE_DASHBOARD_FORBIDDEN"
    });
  });

  it("loads the manager dashboard for manageable teams", async () => {
    const listTeams = vi.fn().mockResolvedValue([
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
    ]);
    const loadDashboard = vi.fn().mockResolvedValue({
      summary: {
        totalTaskCount: 4
      },
      charts: {
        workloadByEmployee: []
      },
      tasks: {
        urgentTasks: []
      }
    });

    const result = await getManagerDashboardForUser(
      managerUser,
      {},
      {
        listTeams,
        loadDashboard
      }
    );

    expect(loadDashboard).toHaveBeenCalledWith({
      teamIds: ["team-1"]
    });
    expect(result.teams).toHaveLength(1);
    expect(result.summary.totalTaskCount).toBe(4);
  });

  it("filters the manager dashboard to the selected manageable team", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        canManageTeam: true
      },
      {
        id: "team-2",
        canManageTeam: true
      }
    ]);
    const loadDashboard = vi.fn().mockResolvedValue({
      summary: {
        totalTaskCount: 1
      },
      charts: {},
      tasks: {}
    });

    await getManagerDashboardForUser(
      managerUser,
      {
        teamId: "team-2"
      },
      {
        listTeams,
        loadDashboard
      }
    );

    expect(loadDashboard).toHaveBeenCalledWith({
      teamIds: ["team-2"]
    });
  });

  it("throws when a requested manager dashboard team is not manageable", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        canManageTeam: true
      }
    ]);

    await expect(
      getManagerDashboardForUser(
        managerUser,
        {
          teamId: "team-2"
        },
        {
          listTeams
        }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_NOT_FOUND"
    });
  });

  it("returns an empty manager dashboard when no manageable teams exist", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        canManageTeam: false
      }
    ]);

    const result = await getManagerDashboardForUser(
      managerUser,
      {},
      {
        listTeams
      }
    );

    expect(result.summary.totalTaskCount).toBe(0);
    expect(result.teams).toHaveLength(0);
  });
});
