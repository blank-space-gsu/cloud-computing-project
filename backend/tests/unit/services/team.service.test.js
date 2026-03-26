import { describe, expect, it, vi } from "vitest";
import {
  getTeamByIdForUser,
  listTeamMembersForUser,
  listTeamsForUser
} from "../../../src/services/team.service.js";

const employeeUser = {
  id: "11111111-1111-1111-1111-111111111111",
  appRole: "employee"
};

const managerUser = {
  id: "22222222-2222-2222-2222-222222222222",
  appRole: "manager"
};

const adminUser = {
  id: "33333333-3333-3333-3333-333333333333",
  appRole: "admin"
};

const sampleTeam = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Operations Team",
  description: "Demo team",
  membershipRole: "manager",
  memberCount: 3,
  managerCount: 1
};

describe("team service", () => {
  it("decorates accessible teams with canManageTeam for managers", async () => {
    const listTeams = vi.fn().mockResolvedValue([sampleTeam]);

    const result = await listTeamsForUser(managerUser, { listTeams });

    expect(result[0]).toMatchObject({
      id: sampleTeam.id,
      canManageTeam: true
    });
  });

  it("allows admins to manage any listed team", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        ...sampleTeam,
        membershipRole: null
      }
    ]);

    const result = await listTeamsForUser(adminUser, { listTeams });

    expect(result[0].canManageTeam).toBe(true);
  });

  it("throws TEAM_NOT_FOUND when a team is outside the user scope", async () => {
    const findTeam = vi.fn().mockResolvedValue(null);

    await expect(
      getTeamByIdForUser(employeeUser, sampleTeam.id, { findTeam })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_NOT_FOUND"
    });
  });

  it("returns a team detail when the team is accessible", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      ...sampleTeam,
      membershipRole: "member"
    });

    const result = await getTeamByIdForUser(employeeUser, sampleTeam.id, {
      findTeam
    });

    expect(result.canManageTeam).toBe(false);
    expect(result.name).toBe("Operations Team");
  });

  it("loads team members after confirming team access", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const listMembers = vi.fn().mockResolvedValue([
      {
        id: "member-1",
        fullName: "Maya Manager",
        membershipRole: "manager"
      }
    ]);

    const result = await listTeamMembersForUser(managerUser, sampleTeam.id, {
      findTeam,
      listMembers
    });

    expect(result.team.canManageTeam).toBe(true);
    expect(result.members).toHaveLength(1);
    expect(listMembers).toHaveBeenCalledWith({
      teamId: sampleTeam.id
    });
  });
});
