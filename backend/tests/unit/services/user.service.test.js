import { describe, expect, it, vi } from "vitest";
import {
  createEmployeeForUser,
  listDirectoryUsersForUser,
  updateCurrentUserProfile,
  updateUserAvatarForUser
} from "../../../src/services/user.service.js";

const managerUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "manager"
};

const employeeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "employee"
};

const adminUser = {
  id: "33333333-3333-4333-8333-333333333333",
  appRole: "admin"
};

describe("user service", () => {
  it("updates self-profile fields for the current user", async () => {
    const updateProfile = vi.fn().mockResolvedValue({
      id: managerUser.id,
      firstName: "Maya",
      address: "123 Demo Street"
    });

    const result = await updateCurrentUserProfile(
      managerUser,
      {
        firstName: "Maya",
        address: "123 Demo Street"
      },
      {
        updateProfile
      }
    );

    expect(updateProfile).toHaveBeenCalledWith(managerUser.id, {
      firstName: "Maya",
      address: "123 Demo Street"
    });
    expect(result.address).toBe("123 Demo Street");
  });

  it("rejects self-profile updates for forbidden fields", async () => {
    await expect(
      updateCurrentUserProfile(employeeUser, {
        appRole: "admin"
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "PROFILE_UPDATE_FORBIDDEN"
    });
  });

  it("lists people directory records for managers", async () => {
    const listUsers = vi.fn().mockResolvedValue([
      {
        id: employeeUser.id,
        appRole: "employee"
      }
    ]);

    const result = await listDirectoryUsersForUser(
      managerUser,
      {
        role: "employee"
      },
      {
        listUsers
      }
    );

    expect(result).toHaveLength(1);
    expect(listUsers).toHaveBeenCalledWith({
      role: "employee"
    });
  });

  it("rejects people directory access for employees", async () => {
    await expect(
      listDirectoryUsersForUser(employeeUser, {})
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "USER_DIRECTORY_FORBIDDEN"
    });
  });

  it("creates an employee auth user, profile, membership, and notification", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      name: "Operations Team",
      membershipRole: "manager"
    });
    const supabaseClient = {
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: "55555555-5555-4555-8555-555555555555"
              }
            },
            error: null
          }),
          deleteUser: vi.fn()
        }
      }
    };
    const saveProfile = vi.fn().mockResolvedValue({});
    const addTeamMembership = vi.fn().mockResolvedValue({});
    const notifyTeamAdded = vi.fn().mockResolvedValue({});
    const findUser = vi.fn().mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      email: "new.employee@cloudcomputing.local",
      appRole: "employee",
      teams: [
        {
          teamId: "44444444-4444-4444-8444-444444444444",
          teamName: "Operations Team",
          membershipRole: "member"
        }
      ]
    });

    const result = await createEmployeeForUser(
      managerUser,
      {
        email: "new.employee@cloudcomputing.local",
        password: "Password123",
        firstName: "New",
        lastName: "Employee",
        teamId: "44444444-4444-4444-8444-444444444444"
      },
      {
        findTeam,
        supabaseClient,
        saveProfile,
        addTeamMembership,
        findUser,
        notifyTeamAdded
      }
    );

    expect(supabaseClient.auth.admin.createUser).toHaveBeenCalled();
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.employee@cloudcomputing.local",
        appRole: "employee"
      })
    );
    expect(addTeamMembership).toHaveBeenCalledWith({
      teamId: "44444444-4444-4444-8444-444444444444",
      userId: "55555555-5555-4555-8555-555555555555",
      membershipRole: "member"
    });
    expect(notifyTeamAdded).toHaveBeenCalledWith({
      userId: "55555555-5555-4555-8555-555555555555",
      teamId: "44444444-4444-4444-8444-444444444444",
      teamName: "Operations Team"
    });
    expect(result.email).toBe("new.employee@cloudcomputing.local");
  });

  it("updates user avatars for admins", async () => {
    const findUser = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      teams: []
    });
    const updateProfile = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      avatarUrl: "https://example.com/avatar.png"
    });

    const result = await updateUserAvatarForUser(
      adminUser,
      employeeUser.id,
      {
        avatarUrl: "https://example.com/avatar.png"
      },
      {
        findUser,
        updateProfile
      }
    );

    expect(updateProfile).toHaveBeenCalledWith(employeeUser.id, {
      avatarUrl: "https://example.com/avatar.png"
    });
    expect(result.avatarUrl).toBe("https://example.com/avatar.png");
  });
});
