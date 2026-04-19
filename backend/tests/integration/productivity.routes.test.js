import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  getProductivityMetricsForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  getProductivityMetricsForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  signupUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/productivity.service.js", () => ({
  getProductivityMetricsForUser
}));

const { default: app } = await import("../../src/app.js");

describe("productivity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("returns productivity metrics for an authenticated user", async () => {
    getProductivityMetricsForUser.mockResolvedValue({
      scope: "team",
      referenceDate: "2026-03-26",
      selectedTeamId: null,
      availableTeams: [],
      user: null,
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

    const response = await request(app)
      .get("/api/v1/productivity-metrics")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.scope).toBe("team");
    expect(response.body.data.rollups.weekly.taskCount).toBe(2);
  });

  it("validates productivity query params", async () => {
    const response = await request(app)
      .get("/api/v1/productivity-metrics?teamId=not-a-uuid")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects userId for team scope", async () => {
    const response = await request(app)
      .get(
        "/api/v1/productivity-metrics?scope=team&userId=11111111-1111-4111-8111-111111111111"
      )
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("passes parsed filters to the productivity service", async () => {
    getProductivityMetricsForUser.mockResolvedValue({
      scope: "individual",
      referenceDate: "2026-03-24",
      selectedTeamId: "123e4567-e89b-42d3-a456-426614174000",
      availableTeams: [],
      user: {
        id: "11111111-1111-4111-8111-111111111111"
      },
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

    const response = await request(app)
      .get(
        "/api/v1/productivity-metrics?scope=individual&teamId=123e4567-e89b-42d3-a456-426614174000&referenceDate=2026-03-24"
      )
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(getProductivityMetricsForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        appRole: "manager"
      }),
      {
        scope: "individual",
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        referenceDate: "2026-03-24"
      }
    );
  });
});
