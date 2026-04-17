import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  listTeamsForUser,
  getTeamByIdForUser,
  getTeamJoinAccessForUser,
  listTeamMembersForUser,
  createTeamForUser,
  updateTeamForUser,
  regenerateTeamJoinAccessForUser,
  addTeamMemberForUser,
  removeTeamMemberForUser,
  leaveTeamForUser,
  joinTeamForUser
} = vi.hoisted(() => ({
    resolveAuthenticatedUser: vi.fn(),
    listTeamsForUser: vi.fn(),
    getTeamByIdForUser: vi.fn(),
    getTeamJoinAccessForUser: vi.fn(),
    listTeamMembersForUser: vi.fn(),
    createTeamForUser: vi.fn(),
    updateTeamForUser: vi.fn(),
    regenerateTeamJoinAccessForUser: vi.fn(),
    addTeamMemberForUser: vi.fn(),
    removeTeamMemberForUser: vi.fn(),
    leaveTeamForUser: vi.fn(),
    joinTeamForUser: vi.fn()
  }));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/team.service.js", () => ({
  listTeamsForUser,
  getTeamByIdForUser,
  getTeamJoinAccessForUser,
  listTeamMembersForUser,
  createTeamForUser,
  updateTeamForUser,
  regenerateTeamJoinAccessForUser,
  addTeamMemberForUser,
  removeTeamMemberForUser,
  leaveTeamForUser,
  joinTeamForUser
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

  it("creates a team for managers", async () => {
    createTeamForUser.mockResolvedValue({
      id: validTeamId,
      name: "New Team",
      canManageTeam: true
    });

    const response = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", "Bearer access-token")
      .send({
        name: "New Team",
        description: "Freshly created"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.team.name).toBe("New Team");
  });

  it("rejects team creation for employees", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", "Bearer access-token")
      .send({
        name: "New Team"
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("updates a team for managers", async () => {
    updateTeamForUser.mockResolvedValue({
      id: validTeamId,
      name: "Renamed Team",
      canManageTeam: true
    });

    const response = await request(app)
      .patch(`/api/v1/teams/${validTeamId}`)
      .set("Authorization", "Bearer access-token")
      .send({
        name: "Renamed Team"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.team.name).toBe("Renamed Team");
  });

  it("loads current team join access for managers", async () => {
    getTeamJoinAccessForUser.mockResolvedValue({
      team: {
        id: validTeamId,
        name: "Operations Team"
      },
      joinAccess: {
        teamId: validTeamId,
        joinCode: "OPS12345",
        inviteUrl: "http://localhost:5500/#/join?inviteToken=abc"
      }
    });

    const response = await request(app)
      .get(`/api/v1/teams/${validTeamId}/join-access`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.joinAccess.joinCode).toBe("OPS12345");
  });

  it("regenerates team join access for managers", async () => {
    regenerateTeamJoinAccessForUser.mockResolvedValue({
      team: {
        id: validTeamId,
        name: "Operations Team"
      },
      joinAccess: {
        teamId: validTeamId,
        joinCode: "NEWCODE9",
        inviteUrl: "http://localhost:5500/#/join?inviteToken=new-token"
      }
    });

    const response = await request(app)
      .post(`/api/v1/teams/${validTeamId}/join-access/regenerate`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.joinAccess.joinCode).toBe("NEWCODE9");
  });

  it("adds a team member", async () => {
    addTeamMemberForUser.mockResolvedValue({
      team: {
        id: validTeamId,
        name: "Operations Team"
      },
      member: {
        id: "member-1",
        fullName: "Ethan Employee"
      }
    });

    const response = await request(app)
      .post(`/api/v1/teams/${validTeamId}/members`)
      .set("Authorization", "Bearer access-token")
      .send({
        userId: "55555555-5555-4555-8555-555555555555"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.member.fullName).toBe("Ethan Employee");
  });

  it("removes a team member", async () => {
    removeTeamMemberForUser.mockResolvedValue({
      teamId: validTeamId,
      userId: "55555555-5555-4555-8555-555555555555",
      membershipRole: "member"
    });

    const response = await request(app)
      .delete(`/api/v1/teams/${validTeamId}/members/55555555-5555-4555-8555-555555555555`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.userId).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("allows employees to leave their own team membership", async () => {
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
    leaveTeamForUser.mockResolvedValue({
      team: {
        id: validTeamId,
        name: "Operations Team"
      },
      membership: {
        teamId: validTeamId,
        userId: "22222222-2222-2222-2222-222222222222",
        membershipStatus: "left"
      }
    });

    const response = await request(app)
      .post(`/api/v1/teams/${validTeamId}/members/me/leave`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.membership.membershipStatus).toBe("left");
  });
});
