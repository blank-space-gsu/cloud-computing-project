import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  createHoursLogForUser,
  listHoursLogsForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  createHoursLogForUser: vi.fn(),
  listHoursLogsForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  signupUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/hoursLogged.service.js", () => ({
  createHoursLogForUser,
  listHoursLogsForUser
}));

const { default: app } = await import("../../src/app.js");

describe("hours logged routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("lists hours logs with summary metadata", async () => {
    listHoursLogsForUser.mockResolvedValue({
      hoursLogs: [
        {
          id: "123e4567-e89b-42d3-a456-426614174111",
          hours: 4
        }
      ],
      total: 1,
      summary: {
        entryCount: 1,
        totalHours: 4,
        currentWeekHours: 4,
        currentMonthHours: 4
      },
      charts: {
        byDate: []
      }
    });

    const response = await request(app)
      .get("/api/v1/hours-logged")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.hoursLogs).toHaveLength(1);
    expect(response.body.data.summary.totalHours).toBe(4);
    expect(response.body.meta.total).toBe(1);
  });

  it("creates an hours log entry", async () => {
    createHoursLogForUser.mockResolvedValue({
      id: "123e4567-e89b-42d3-a456-426614174111",
      hours: 3.5
    });

    const response = await request(app)
      .post("/api/v1/hours-logged")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        workDate: "2026-03-26",
        hours: 3.5,
        note: "Wrapped up reporting"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.hoursLog.hours).toBe(3.5);
  });

  it("rejects invalid hours log creation payloads", async () => {
    const response = await request(app)
      .post("/api/v1/hours-logged")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "not-a-uuid",
        workDate: "2026-02-31",
        hours: 30
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid date range filters", async () => {
    const response = await request(app)
      .get("/api/v1/hours-logged?dateFrom=2026-03-31&dateTo=2026-03-01")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
