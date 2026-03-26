import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  listGoalsForUser,
  createGoalForUser,
  updateGoalForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  listGoalsForUser: vi.fn(),
  createGoalForUser: vi.fn(),
  updateGoalForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/goal.service.js", () => ({
  listGoalsForUser,
  createGoalForUser,
  updateGoalForUser
}));

const { default: app } = await import("../../src/app.js");

const goalId = "123e4567-e89b-42d3-a456-426614174111";

describe("goals routes", () => {
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

  it("lists goals with summary metadata", async () => {
    listGoalsForUser.mockResolvedValue({
      selectedTeamId: null,
      selectedUserId: null,
      availableTeams: [],
      goals: [
        {
          id: goalId,
          title: "March sales target"
        }
      ],
      total: 1,
      summary: {
        totalGoalCount: 1
      },
      charts: {
        byStatus: []
      }
    });

    const response = await request(app)
      .get("/api/v1/goals")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.goals).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("creates a goal for privileged users", async () => {
    createGoalForUser.mockResolvedValue({
      id: goalId,
      title: "March sales target"
    });

    const response = await request(app)
      .post("/api/v1/goals")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        targetUserId: "123e4567-e89b-42d3-a456-426614174222",
        title: "March sales target",
        scope: "user",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        targetValue: 15000,
        unit: "USD"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.goal.id).toBe(goalId);
  });

  it("rejects invalid goal payloads", async () => {
    const response = await request(app)
      .post("/api/v1/goals")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "not-a-uuid",
        scope: "user",
        startDate: "2026-03-31",
        endDate: "2026-03-01",
        targetValue: -1
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates a goal", async () => {
    updateGoalForUser.mockResolvedValue({
      id: goalId,
      actualValue: 12000
    });

    const response = await request(app)
      .patch(`/api/v1/goals/${goalId}`)
      .set("Authorization", "Bearer access-token")
      .send({
        actualValue: 12000
      });

    expect(response.status).toBe(200);
    expect(response.body.data.goal.actualValue).toBe(12000);
  });

  it("validates the goal id parameter", async () => {
    const response = await request(app)
      .patch("/api/v1/goals/not-a-uuid")
      .set("Authorization", "Bearer access-token")
      .send({
        actualValue: 12000
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks employees from goal writes", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .post("/api/v1/goals")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        targetUserId: "123e4567-e89b-42d3-a456-426614174222",
        title: "March sales target",
        scope: "user",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        targetValue: 15000,
        unit: "USD"
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
