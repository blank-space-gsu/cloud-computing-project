import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  listDirectoryUsersForUser,
  createEmployeeForUser,
  updateUserAvatarForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  getCurrentUserProfile: vi.fn((user) => user),
  updateCurrentUserProfile: vi.fn(),
  listDirectoryUsersForUser: vi.fn(),
  createEmployeeForUser: vi.fn(),
  updateUserAvatarForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  signupUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/user.service.js", () => ({
  getCurrentUserProfile,
  updateCurrentUserProfile,
  listDirectoryUsersForUser,
  createEmployeeForUser,
  updateUserAvatarForUser
}));

const { default: app } = await import("../../src/app.js");

describe("users routes", () => {
  const managerUser = {
    id: "11111111-1111-1111-1111-111111111111",
    email: "manager.demo@cloudcomputing.local",
    fullName: "Maya Manager",
    appRole: "manager",
    teams: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedUser.mockResolvedValue({
      user: managerUser,
      accessToken: "access-token"
    });
  });

  it("requires authentication for /users/me", async () => {
    const response = await request(app).get("/api/v1/users/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns the current user profile", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("manager.demo@cloudcomputing.local");
  });

  it("updates the current user profile", async () => {
    updateCurrentUserProfile.mockResolvedValue({
      ...managerUser,
      firstName: "Maya",
      lastName: "Manager",
      dateOfBirth: "1990-01-10",
      address: "123 Demo Street"
    });

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", "Bearer access-token")
      .send({
        firstName: "Maya",
        dateOfBirth: "1990-01-10",
        address: "123 Demo Street"
      });

    expect(response.status).toBe(200);
    expect(updateCurrentUserProfile).toHaveBeenCalledWith(
      managerUser,
      expect.objectContaining({
        firstName: "Maya",
        dateOfBirth: "1990-01-10",
        address: "123 Demo Street"
      })
    );
  });

  it("rejects forbidden self-profile fields", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", "Bearer access-token")
      .send({
        appRole: "admin"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists the people directory for managers", async () => {
    listDirectoryUsersForUser.mockResolvedValue([
      {
        id: "22222222-2222-2222-2222-222222222222",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        avatarUrl: null,
        teams: []
      }
    ]);

    const response = await request(app)
      .get("/api/v1/users?role=employee")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.meta.count).toBe(1);
  });

  it("rejects people directory access for employees", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        ...managerUser,
        appRole: "employee"
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .get("/api/v1/users")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("creates an employee for managers", async () => {
    createEmployeeForUser.mockResolvedValue({
      id: "33333333-3333-3333-3333-333333333333",
      email: "new.employee@cloudcomputing.local",
      fullName: "New Employee",
      appRole: "employee",
      teams: []
    });

    const response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", "Bearer access-token")
      .send({
        email: "new.employee@cloudcomputing.local",
        password: "Password123",
        firstName: "New",
        lastName: "Employee",
        jobTitle: "Coordinator",
        teamId: "123e4567-e89b-42d3-a456-426614174000"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("new.employee@cloudcomputing.local");
  });

  it("updates a user avatar for managers", async () => {
    const validUserId = "123e4567-e89b-42d3-a456-426614174001";

    updateUserAvatarForUser.mockResolvedValue({
      id: validUserId,
      avatarUrl: "https://example.com/avatar.png"
    });

    const response = await request(app)
      .patch(`/api/v1/users/${validUserId}/avatar`)
      .set("Authorization", "Bearer access-token")
      .send({
        avatarUrl: "https://example.com/avatar.png"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.avatarUrl).toBe("https://example.com/avatar.png");
  });
});
