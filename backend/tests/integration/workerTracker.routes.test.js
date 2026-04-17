import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  getWorkerTrackerForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  getWorkerTrackerForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/workerTracker.service.js", () => ({
  getWorkerTrackerForUser
}));

const { default: app } = await import("../../src/app.js");

describe("worker tracker routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });
  });

  it("returns worker tracker data for an authenticated manager", async () => {
    getWorkerTrackerForUser.mockResolvedValue({
      availableTeams: [],
      selectedTeamId: null,
      summary: {
        completionPercent: 0
      },
      members: [],
      tasks: [],
      unassignedTasks: []
    });

    const response = await request(app)
      .get("/api/v1/worker-tracker")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.summary.completionPercent).toBe(0);
  });

  it("passes parsed filters to the worker tracker service", async () => {
    getWorkerTrackerForUser.mockResolvedValue({
      availableTeams: [],
      selectedTeamId: "123e4567-e89b-42d3-a456-426614174000",
      summary: {
        completionPercent: 42
      },
      members: [],
      tasks: [],
      unassignedTasks: []
    });

    const response = await request(app)
      .get(
        "/api/v1/worker-tracker?teamId=123e4567-e89b-42d3-a456-426614174000&memberUserId=123e4567-e89b-42d3-a456-426614174111"
      )
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(getWorkerTrackerForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        appRole: "manager"
      }),
      {
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        memberUserId: "123e4567-e89b-42d3-a456-426614174111"
      }
    );
  });

  it("validates worker tracker query params", async () => {
    const response = await request(app)
      .get("/api/v1/worker-tracker?teamId=not-a-uuid")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks employees from the worker tracker route", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "employee-token"
    });

    const response = await request(app)
      .get("/api/v1/worker-tracker")
      .set("Authorization", "Bearer employee-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
