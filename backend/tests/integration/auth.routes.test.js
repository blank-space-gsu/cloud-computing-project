import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginUser, resolveAuthenticatedUser } = vi.hoisted(() => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser,
  resolveAuthenticatedUser
}));

const { default: app } = await import("../../src/app.js");

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs in successfully and returns the standard envelope", async () => {
    loginUser.mockResolvedValue({
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "bearer",
        expiresIn: 3600,
        expiresAt: "2026-03-26T05:00:00.000Z"
      },
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      }
    });

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "manager.demo@cloudcomputing.local",
      password: "example-password"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Login successful.");
    expect(response.body.data.user.appRole).toBe("manager");
  });

  it("rejects invalid login payloads", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "not-an-email",
      password: "123"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON bodies with a client error code", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("requires a bearer token for /auth/me", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the current user context for a valid bearer token", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("manager.demo@cloudcomputing.local");
    expect(response.body.data.accessToken).toBeUndefined();
  });

  it("enforces manager-only access checks", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-2222-2222-222222222222",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/auth/manager-access")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
