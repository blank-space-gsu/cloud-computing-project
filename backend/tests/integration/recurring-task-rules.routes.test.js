import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  createRecurringTaskRuleForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  createRecurringTaskRuleForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/recurringTaskRule.service.js", () => ({
  createRecurringTaskRuleForUser
}));

const { default: app } = await import("../../src/app.js");

describe("recurring task rule routes", () => {
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

  it("creates a recurring task rule for privileged users", async () => {
    createRecurringTaskRuleForUser.mockResolvedValue({
      id: "rule-1",
      title: "Daily standup prep",
      frequency: "daily"
    });

    const response = await request(app)
      .post("/api/v1/recurring-task-rules")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        title: "Daily standup prep",
        frequency: "daily",
        dueTime: "09:00",
        startsOn: "2026-04-20"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.recurringTaskRule.id).toBe("rule-1");
  });

  it("validates weekly recurring rules", async () => {
    const response = await request(app)
      .post("/api/v1/recurring-task-rules")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        title: "Weekly handoff",
        frequency: "weekly",
        dueTime: "09:00",
        startsOn: "2026-04-20"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
