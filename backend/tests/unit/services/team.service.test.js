import { describe, expect, it, vi } from "vitest";
import {
  addTeamMemberForUser,
  createTeamForUser,
  getTeamByIdForUser,
  listTeamMembersForUser,
  listTeamsForUser,
  removeTeamMemberForUser,
  updateTeamForUser
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

  it("creates a team and assigns the creator as manager", async () => {
    const insertTeam = vi.fn().mockResolvedValue(sampleTeam.id);
    const addCreatorMembership = vi.fn().mockResolvedValue({});
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);

    const result = await createTeamForUser(managerUser, sampleTeam, {
      insertTeam,
      addCreatorMembership,
      findTeam
    });

    expect(insertTeam).toHaveBeenCalledWith({
      name: sampleTeam.name,
      description: sampleTeam.description
    });
    expect(addCreatorMembership).toHaveBeenCalledWith({
      teamId: sampleTeam.id,
      userId: managerUser.id,
      membershipRole: "manager"
    });
    expect(result.name).toBe("Operations Team");
  });

  it("rejects team updates for employees", async () => {
    await expect(
      updateTeamForUser(employeeUser, sampleTeam.id, { name: "Updated Team" })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TEAM_UPDATE_FORBIDDEN"
    });
  });

  it("adds a member and creates a team-added notification", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "member-1",
        fullName: "Ethan Employee",
        membershipRole: "member"
      });
    const findUser = vi.fn().mockResolvedValue({
      id: "member-1",
      isActive: true
    });
    const insertTeamMember = vi.fn().mockResolvedValue({});
    const notifyTeamAdded = vi.fn().mockResolvedValue({});

    const result = await addTeamMemberForUser(
      managerUser,
      sampleTeam.id,
      {
        userId: "member-1",
        membershipRole: "member"
      },
      {
        findTeam,
        findMember,
        findUser,
        insertTeamMember,
        notifyTeamAdded
      }
    );

    expect(insertTeamMember).toHaveBeenCalledWith({
      teamId: sampleTeam.id,
      userId: "member-1",
      membershipRole: "member"
    });
    expect(notifyTeamAdded).toHaveBeenCalledWith({
      userId: "member-1",
      teamId: sampleTeam.id,
      teamName: sampleTeam.name
    });
    expect(result.member.fullName).toBe("Ethan Employee");
  });

  it("rejects duplicate team memberships", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue({
      id: "member-1"
    });

    await expect(
      addTeamMemberForUser(
        managerUser,
        sampleTeam.id,
        {
          userId: "member-1",
          membershipRole: "member"
        },
        {
          findTeam,
          findMember
        }
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "TEAM_MEMBERSHIP_EXISTS"
    });
  });

  it("removes team members", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue({
      id: "member-1",
      membershipRole: "member"
    });
    const removeTeamMember = vi.fn().mockResolvedValue({
      team_id: sampleTeam.id,
      user_id: "member-1",
      membership_role: "member"
    });

    const result = await removeTeamMemberForUser(
      managerUser,
      sampleTeam.id,
      "member-1",
      {
        findTeam,
        findMember,
        removeTeamMember
      }
    );

    expect(removeTeamMember).toHaveBeenCalledWith({
      teamId: sampleTeam.id,
      userId: "member-1"
    });
    expect(result.userId).toBe("member-1");
  });
});
