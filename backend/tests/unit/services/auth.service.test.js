import { describe, expect, it, vi } from "vitest";
import {
  loginUser,
  resolveAuthenticatedUser
} from "../../../src/services/auth.service.js";

const buildProfile = (overrides = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "manager.demo@cloudcomputing.local",
  firstName: "Maya",
  lastName: "Manager",
  fullName: "Maya Manager",
  jobTitle: "Operations Manager",
  appRole: "manager",
  isActive: true,
  teams: [],
  ...overrides
});

describe("auth service", () => {
  it("logs a user in and returns session plus profile data", async () => {
    const supabaseClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email_confirmed_at: "2026-03-26T03:00:00.000Z",
              last_sign_in_at: "2026-03-26T03:10:00.000Z"
            },
            session: {
              access_token: "access-token",
              refresh_token: "refresh-token",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: 1774500000
            }
          },
          error: null
        })
      }
    };

    const loadUserAccessProfile = vi.fn().mockResolvedValue(buildProfile());

    const result = await loginUser(
      {
        email: "manager.demo@cloudcomputing.local",
        password: "example-password"
      },
      {
        supabaseClient,
        loadUserAccessProfile
      }
    );

    expect(result.session).toMatchObject({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "bearer",
      expiresIn: 3600
    });
    expect(result.user.fullName).toBe("Maya Manager");
    expect(result.user.appRole).toBe("manager");
  });

  it("rejects invalid credentials", async () => {
    const supabaseClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: null,
            session: null
          },
          error: {
            message: "Invalid login credentials"
          }
        })
      }
    };

    await expect(
      loginUser(
        {
          email: "wrong@example.com",
          password: "bad-password"
        },
        {
          supabaseClient,
          loadUserAccessProfile: vi.fn()
        }
      )
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS"
    });
  });

  it("resolves an authenticated user from a bearer token", async () => {
    const supabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email_confirmed_at: "2026-03-26T03:00:00.000Z",
              last_sign_in_at: "2026-03-26T03:10:00.000Z"
            }
          },
          error: null
        })
      }
    };

    const loadUserAccessProfile = vi.fn().mockResolvedValue(buildProfile());

    const result = await resolveAuthenticatedUser("access-token", {
      supabaseClient,
      loadUserAccessProfile
    });

    expect(result.user.email).toBe("manager.demo@cloudcomputing.local");
    expect(result.user.teams).toEqual([]);
    expect(result.accessToken).toBe("access-token");
  });

  it("rejects users who are authenticated but not provisioned", async () => {
    const supabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id
            }
          },
          error: null
        })
      }
    };

    await expect(
      resolveAuthenticatedUser("access-token", {
        supabaseClient,
        loadUserAccessProfile: vi.fn().mockResolvedValue(null)
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_NOT_PROVISIONED"
    });
  });
});
