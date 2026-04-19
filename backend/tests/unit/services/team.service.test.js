import { describe, expect, it, vi } from "vitest";
import {
  addTeamMemberForUser,
  createTeamForUser,
  getTeamJoinAccessForUser,
  getTeamByIdForUser,
  joinTeamForUser,
  leaveTeamForUser,
  listTeamMembersForUser,
  listTeamsForUser,
  regenerateTeamJoinAccessForUser,
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
      teamId: sampleTeam.id,
      membershipStatus: "active"
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

  it("adds a member to a team", async () => {
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
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

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
          recordMembershipEvent,
          runTransaction
        }
    );

    expect(insertTeamMember).toHaveBeenCalledWith({
      teamId: sampleTeam.id,
      userId: "member-1",
      membershipRole: "member"
    }, { pool: {} });
    expect(result.member.fullName).toBe("Ethan Employee");
  });

  it("rejects duplicate team memberships", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue({
      id: "member-1",
      membershipStatus: "active"
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

  it("reactivates an inactive membership when a manager adds the user back", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi
      .fn()
      .mockResolvedValueOnce({
        id: "member-1",
        membershipRole: "member",
        membershipStatus: "left"
      })
      .mockResolvedValueOnce({
        id: "member-1",
        fullName: "Ethan Employee",
        membershipRole: "member",
        membershipStatus: "active"
      });
    const findUser = vi.fn().mockResolvedValue({
      id: "member-1",
      isActive: true
    });
    const reactivateMember = vi.fn().mockResolvedValue({});
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

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
        reactivateMember,
        recordMembershipEvent,
        runTransaction
      }
    );

    expect(reactivateMember).toHaveBeenCalledWith(
      {
        teamId: sampleTeam.id,
        userId: "member-1",
        membershipRole: "member"
      },
      { pool: {} }
    );
    expect(recordMembershipEvent).toHaveBeenCalled();
    expect(result.member.membershipStatus).toBe("active");
  });

  it("removes team members", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue({
      id: "member-1",
      membershipRole: "member",
      membershipStatus: "active"
    });
    const removeTeamMember = vi.fn().mockResolvedValue({
      teamId: sampleTeam.id,
      userId: "member-1",
      membershipRole: "member",
      membershipStatus: "removed"
    });
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const countOpenAssignments = vi.fn().mockResolvedValue(0);
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await removeTeamMemberForUser(
      managerUser,
      sampleTeam.id,
      "member-1",
      {
        findTeam,
        findMember,
        removeTeamMember,
        recordMembershipEvent,
        countOpenAssignments,
        runTransaction
      }
    );

    expect(removeTeamMember).toHaveBeenCalledWith({
      teamId: sampleTeam.id,
      userId: "member-1"
    }, { pool: {} });
    expect(result.userId).toBe("member-1");
    expect(result.membershipStatus).toBe("removed");
  });

  it("loads current team join access for managers", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const listTokens = vi
      .fn()
      .mockResolvedValueOnce([
        {
          tokenType: "join_code",
          grantedMembershipRole: "member",
          tokenValue: "OPS12345"
        },
        {
          tokenType: "invite_link",
          grantedMembershipRole: "member",
          tokenValue: "invite-token"
        }
      ])
      .mockResolvedValueOnce([
        {
          tokenType: "join_code",
          grantedMembershipRole: "manager",
          tokenValue: "MGR12345"
        },
        {
          tokenType: "invite_link",
          grantedMembershipRole: "manager",
          tokenValue: "manager-invite-token"
        }
      ]);

    const result = await getTeamJoinAccessForUser(managerUser, sampleTeam.id, {
      findTeam,
      listTokens
    });

    expect(result.joinAccess.joinCode).toBe("OPS12345");
    expect(result.managerJoinAccess.joinCode).toBe("MGR12345");
    expect(result.managerJoinAccess.inviteUrl).toContain("manager-invite-token");
  });

  it("regenerates member join access by default for managers", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const listTokens = vi.fn().mockResolvedValue([
      {
        tokenType: "join_code",
        grantedMembershipRole: "manager",
        tokenValue: "MGR12345"
      },
      {
        tokenType: "invite_link",
        grantedMembershipRole: "manager",
        tokenValue: "manager-invite-token"
      }
    ]);
    const revokeTokens = vi.fn().mockResolvedValue(2);
    const insertToken = vi
      .fn()
      .mockResolvedValueOnce({
        tokenType: "join_code",
        grantedMembershipRole: "member",
        tokenValue: "OPS12345"
      })
      .mockResolvedValueOnce({
        tokenType: "invite_link",
        grantedMembershipRole: "member",
        tokenValue: "invite-token"
      });
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await regenerateTeamJoinAccessForUser(
      managerUser,
      sampleTeam.id,
      {},
      {
        findTeam,
        listTokens,
        revokeTokens,
        insertToken,
        runTransaction
      }
    );

    expect(revokeTokens).toHaveBeenCalledWith(
      { teamId: sampleTeam.id, grantedMembershipRole: "member" },
      { pool: {} }
    );
    expect(insertToken).toHaveBeenCalledTimes(2);
    expect(result.joinAccess.joinCode).toBe("OPS12345");
  });

  it("regenerates manager join access for managers", async () => {
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const listTokens = vi.fn().mockResolvedValue([
      {
        tokenType: "join_code",
        grantedMembershipRole: "member",
        tokenValue: "OPS12345"
      },
      {
        tokenType: "invite_link",
        grantedMembershipRole: "member",
        tokenValue: "invite-token"
      }
    ]);
    const revokeTokens = vi.fn().mockResolvedValue(2);
    const insertToken = vi
      .fn()
      .mockResolvedValueOnce({
        tokenType: "join_code",
        grantedMembershipRole: "manager",
        tokenValue: "MGR12345"
      })
      .mockResolvedValueOnce({
        tokenType: "invite_link",
        grantedMembershipRole: "manager",
        tokenValue: "manager-invite-token"
      });
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await regenerateTeamJoinAccessForUser(
      managerUser,
      sampleTeam.id,
      {
        membershipRole: "manager"
      },
      {
        findTeam,
        listTokens,
        revokeTokens,
        insertToken,
        runTransaction
      }
    );

    expect(revokeTokens).toHaveBeenCalledWith(
      { teamId: sampleTeam.id, grantedMembershipRole: "manager" },
      { pool: {} }
    );
    expect(result.regeneratedMembershipRole).toBe("manager");
    expect(result.managerJoinAccess.joinCode).toBe("MGR12345");
  });

  it("joins a team with valid employee join access", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      tokenType: "join_code",
      grantedMembershipRole: "member",
      tokenValue: "OPS12345",
      isActive: true,
      revokedAt: null,
      expiresAt: null
    });
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue(null);
    const insertTeamMember = vi.fn().mockResolvedValue({
      teamId: sampleTeam.id,
      userId: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "active"
    });
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await joinTeamForUser(
      employeeUser,
      { joinCode: "OPS12345" },
      {
        findAccessToken,
        findTeam,
        findMember,
        insertTeamMember,
        recordMembershipEvent,
        runTransaction
      }
    );

    expect(insertTeamMember).toHaveBeenCalledWith(
      {
        teamId: sampleTeam.id,
        userId: employeeUser.id,
        membershipRole: "member"
      },
      { pool: {} }
    );
    expect(result.rejoined).toBe(false);
  });

  it("reactivates a left membership on self-rejoin", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      tokenType: "invite_link",
      grantedMembershipRole: "member",
      tokenValue: "invite-token",
      isActive: true,
      revokedAt: null,
      expiresAt: null
    });
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "left"
    });
    const reactivateMember = vi.fn().mockResolvedValue({
      teamId: sampleTeam.id,
      userId: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "active"
    });
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await joinTeamForUser(
      employeeUser,
      { inviteToken: "invite-token" },
      {
        findAccessToken,
        findTeam,
        findMember,
        reactivateMember,
        recordMembershipEvent,
        runTransaction
      }
    );

    expect(reactivateMember).toHaveBeenCalled();
    expect(result.rejoined).toBe(true);
  });

  it("rejects revoked join access", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      grantedMembershipRole: "member",
      isActive: false,
      revokedAt: "2026-04-17T00:00:00.000Z",
      expiresAt: null
    });

    await expect(
      joinTeamForUser(employeeUser, { joinCode: "OPS12345" }, { findAccessToken })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TEAM_JOIN_ACCESS_REVOKED"
    });
  });

  it("rejects expired join access", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      grantedMembershipRole: "member",
      isActive: true,
      revokedAt: null,
      expiresAt: "2020-01-01T00:00:00.000Z"
    });

    await expect(
      joinTeamForUser(employeeUser, { joinCode: "OPS12345" }, { findAccessToken })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TEAM_JOIN_ACCESS_EXPIRED"
    });
  });

  it("allows a manager to join through manager-only access", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      tokenType: "join_code",
      grantedMembershipRole: "manager",
      tokenValue: "MGR12345",
      isActive: true,
      revokedAt: null,
      expiresAt: null
    });
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const findMember = vi.fn().mockResolvedValue(null);
    const insertTeamMember = vi.fn().mockResolvedValue({
      teamId: sampleTeam.id,
      userId: managerUser.id,
      membershipRole: "manager",
      membershipStatus: "active"
    });
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await joinTeamForUser(
      managerUser,
      { joinCode: "MGR12345" },
      {
        findAccessToken,
        findTeam,
        findMember,
        insertTeamMember,
        recordMembershipEvent,
        runTransaction
      }
    );

    expect(insertTeamMember).toHaveBeenCalledWith(
      {
        teamId: sampleTeam.id,
        userId: managerUser.id,
        membershipRole: "manager"
      },
      { pool: {} }
    );
    expect(result.membership.membershipRole).toBe("manager");
  });

  it("rejects employee-role join access for manager accounts", async () => {
    const findAccessToken = vi.fn().mockResolvedValue({
      id: "token-1",
      teamId: sampleTeam.id,
      tokenType: "join_code",
      grantedMembershipRole: "member",
      tokenValue: "OPS12345",
      isActive: true,
      revokedAt: null,
      expiresAt: null
    });

    await expect(
      joinTeamForUser(managerUser, { joinCode: "OPS12345" }, { findAccessToken })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TEAM_JOIN_FORBIDDEN"
    });
  });

  it("blocks employee leave when open assignments still exist", async () => {
    const findMember = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "active"
    });
    const countOpenAssignments = vi.fn().mockResolvedValue(2);

    await expect(
      leaveTeamForUser(employeeUser, sampleTeam.id, {
        findMember,
        countOpenAssignments
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "TEAM_LEAVE_BLOCKED_OPEN_ASSIGNMENTS"
    });
  });

  it("allows an employee to leave a team when no open assignments remain", async () => {
    const findMember = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "active"
    });
    const countOpenAssignments = vi.fn().mockResolvedValue(0);
    const findTeam = vi.fn().mockResolvedValue(sampleTeam);
    const leaveMember = vi.fn().mockResolvedValue({
      teamId: sampleTeam.id,
      userId: employeeUser.id,
      membershipRole: "member",
      membershipStatus: "left",
      leftAt: "2026-04-17T00:00:00.000Z"
    });
    const recordMembershipEvent = vi.fn().mockResolvedValue({});
    const runTransaction = vi.fn(async (work) => work({}));

    const result = await leaveTeamForUser(employeeUser, sampleTeam.id, {
      findMember,
      countOpenAssignments,
      findTeam,
      leaveMember,
      recordMembershipEvent,
      runTransaction
    });

    expect(leaveMember).toHaveBeenCalledWith(
      {
        teamId: sampleTeam.id,
        userId: employeeUser.id
      },
      { pool: {} }
    );
    expect(result.membership.membershipStatus).toBe("left");
  });
});
