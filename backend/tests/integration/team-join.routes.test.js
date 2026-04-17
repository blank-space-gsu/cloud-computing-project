import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthenticatedUser, joinTeamForUser } = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  joinTeamForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/team.service.js", () => ({
  listTeamsForUser: vi.fn(),
  getTeamByIdForUser: vi.fn(),
  listTeamMembersForUser: vi.fn(),
  createTeamForUser: vi.fn(),
  updateTeamForUser: vi.fn(),
  getTeamJoinAccessForUser: vi.fn(),
  regenerateTeamJoinAccessForUser: vi.fn(),
  addTeamMemberForUser: vi.fn(),
  removeTeamMemberForUser: vi.fn(),
  leaveTeamForUser: vi.fn(),
  joinTeamForUser
}));

const { default: app } = await import("../../src/app.js");

describe("team join routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("joins a team with a join code", async () => {
    joinTeamForUser.mockResolvedValue({
      team: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Operations Team"
      },
      membership: {
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        userId: "22222222-2222-2222-2222-222222222222",
        membershipStatus: "active"
      },
      rejoined: false
    });

    const response = await request(app)
      .post("/api/v1/team-join")
      .set("Authorization", "Bearer access-token")
      .send({
        joinCode: "ops12345"
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Team joined successfully.");
    expect(response.body.data.team.name).toBe("Operations Team");
  });

  it("returns the rejoin message when a prior membership is reactivated", async () => {
    joinTeamForUser.mockResolvedValue({
      team: {
        id: "123e4567-e89b-42d3-a456-426614174000",
        name: "Operations Team"
      },
      membership: {
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        userId: "22222222-2222-2222-2222-222222222222",
        membershipStatus: "active"
      },
      rejoined: true
    });

    const response = await request(app)
      .post("/api/v1/team-join")
      .set("Authorization", "Bearer access-token")
      .send({
        inviteToken: "invite-token-value"
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Team membership reactivated successfully.");
  });

  it("rejects invalid join payloads", async () => {
    const response = await request(app)
      .post("/api/v1/team-join")
      .set("Authorization", "Bearer access-token")
      .send({
        joinCode: "ABC12345",
        inviteToken: "token"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects team join for managers", async () => {
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
      .post("/api/v1/team-join")
      .set("Authorization", "Bearer access-token")
      .send({
        joinCode: "OPS12345"
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
