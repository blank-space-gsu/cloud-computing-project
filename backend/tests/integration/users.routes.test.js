import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthenticatedUser } = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

const { default: app } = await import("../../src/app.js");

describe("users routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication for /users/me", async () => {
    const response = await request(app).get("/api/v1/users/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the current user profile", async () => {
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
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("manager.demo@cloudcomputing.local");
  });
});
