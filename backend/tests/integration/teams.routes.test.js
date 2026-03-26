import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthenticatedUser, listTeamsForUser, getTeamByIdForUser, listTeamMembersForUser } =
  vi.hoisted(() => ({
    resolveAuthenticatedUser: vi.fn(),
    listTeamsForUser: vi.fn(),
    getTeamByIdForUser: vi.fn(),
    listTeamMembersForUser: vi.fn()
  }));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/team.service.js", () => ({
  listTeamsForUser,
  getTeamByIdForUser,
  listTeamMembersForUser
}));

const { default: app } = await import("../../src/app.js");

describe("teams routes", () => {
  const validTeamId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("lists accessible teams", async () => {
    listTeamsForUser.mockResolvedValue([
      {
        id: validTeamId,
        name: "Operations Team",
        membershipRole: "manager",
        memberCount: 3,
        managerCount: 1,
        canManageTeam: true
      }
    ]);

    const response = await request(app)
      .get("/api/v1/teams")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.teams).toHaveLength(1);
    expect(response.body.meta.count).toBe(1);
  });

  it("validates the team id parameter", async () => {
    const response = await request(app)
      .get("/api/v1/teams/not-a-uuid")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a scoped team detail", async () => {
    getTeamByIdForUser.mockResolvedValue({
      id: validTeamId,
      name: "Operations Team",
      canManageTeam: true
    });

    const response = await request(app)
      .get(`/api/v1/teams/${validTeamId}`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.team.name).toBe("Operations Team");
  });

  it("returns team members for an accessible team", async () => {
    listTeamMembersForUser.mockResolvedValue({
      team: {
        id: validTeamId,
        name: "Operations Team",
        canManageTeam: true
      },
      members: [
        {
          id: "member-1",
          fullName: "Maya Manager",
          membershipRole: "manager"
        }
      ]
    });

    const response = await request(app)
      .get(`/api/v1/teams/${validTeamId}/members`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.members).toHaveLength(1);
    expect(response.body.meta.count).toBe(1);
  });
});
