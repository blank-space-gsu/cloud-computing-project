import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  getEmployeeDashboardForUser,
  getManagerDashboardForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  getEmployeeDashboardForUser: vi.fn(),
  getManagerDashboardForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/dashboard.service.js", () => ({
  getEmployeeDashboardForUser,
  getManagerDashboardForUser
}));

const { default: app } = await import("../../src/app.js");

describe("dashboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the employee dashboard for an employee", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });
    getEmployeeDashboardForUser.mockResolvedValue({
      summary: {
        assignedTaskCount: 2
      },
      charts: {},
      tasks: {}
    });

    const response = await request(app)
      .get("/api/v1/dashboards/employee")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.summary.assignedTaskCount).toBe(2);
  });

  it("blocks managers from the employee dashboard endpoint", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/dashboards/employee")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns the manager dashboard for a manager", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });
    getManagerDashboardForUser.mockResolvedValue({
      selectedTeamId: null,
      teams: [],
      summary: {
        totalTaskCount: 4
      },
      charts: {},
      tasks: {}
    });

    const response = await request(app)
      .get("/api/v1/dashboards/manager")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.summary.totalTaskCount).toBe(4);
  });

  it("validates the optional manager teamId query param", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/dashboards/manager?teamId=not-a-uuid")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks employees from the manager dashboard endpoint", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/dashboards/manager")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
