import { describe, expect, it, vi } from "vitest";
import {
  loginUser,
  signupUser,
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
  it("signs a user up with a selected global app role and returns a pending verification payload", async () => {
    const serviceRoleSupabaseClient = {
      auth: {
        admin: {
          updateUserById: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: buildProfile().id,
                email: "manager.new@tasktrail.local"
              }
            },
            error: null
          }),
          deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null })
        }
      }
    };
    const anonSupabaseClient = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email: "manager.new@tasktrail.local"
            },
            session: null
          },
          error: null
        })
      }
    };
    const syncProfile = vi.fn().mockResolvedValue(buildProfile());
    const findUserByEmail = vi.fn().mockResolvedValue(null);

    const result = await signupUser(
      {
        email: "manager.new@tasktrail.local",
        password: "example-password",
        firstName: "Maya",
        lastName: "Manager",
        jobTitle: "Operations Manager",
        appRole: "manager"
      },
      {
        anonSupabaseClient,
        serviceRoleSupabaseClient,
        findUserByEmail,
        syncProfile,
        currentEnv: {
          authEmailRedirectTo: "http://localhost:5500"
        }
      }
    );

    expect(anonSupabaseClient.auth.signUp).toHaveBeenCalled();
    expect(serviceRoleSupabaseClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      buildProfile().id,
      {
        app_metadata: {
          app_role: "manager"
        }
      }
    );
    expect(syncProfile).toHaveBeenCalled();
    expect(result).toMatchObject({
      email: "manager.new@tasktrail.local",
      appRole: "manager",
      verificationRequired: true,
      verificationEmailSent: true,
      emailRedirectTo: "http://localhost:5500"
    });
  });

  it("surfaces Supabase verification-email rate limiting clearly during signup", async () => {
    const anonSupabaseClient = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: null,
            session: null
          },
          error: {
            status: 429,
            code: "over_email_send_rate_limit",
            message: "Email send rate limit exceeded"
          }
        })
      }
    };

    await expect(
      signupUser(
        {
          email: "manager.new@tasktrail.local",
          password: "example-password",
          firstName: "Maya",
          lastName: "Manager",
          appRole: "manager"
        },
        {
          anonSupabaseClient,
          serviceRoleSupabaseClient: {
            auth: {
              admin: {
                updateUserById: vi.fn()
              }
            }
          },
          findUserByEmail: vi.fn(),
          syncProfile: vi.fn(),
          currentEnv: {
            authEmailRedirectTo: "http://localhost:5500"
          }
        }
      )
    ).rejects.toMatchObject({
      statusCode: 429,
      code: "EMAIL_VERIFICATION_RATE_LIMITED"
    });
  });

  it("logs a user in and returns session plus profile data", async () => {
    const supabaseClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email: "manager.demo@cloudcomputing.local",
              email_confirmed_at: "2026-03-26T03:00:00.000Z",
              last_sign_in_at: "2026-03-26T03:10:00.000Z",
              user_metadata: {
                first_name: "Maya",
                last_name: "Manager",
                job_title: "Operations Manager"
              },
              app_metadata: {
                app_role: "manager"
              }
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

  it("rejects login for accounts that have not verified their email yet", async () => {
    const supabaseClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: null,
            session: null
          },
          error: {
            code: "email_not_confirmed",
            message: "Email not confirmed"
          }
        })
      }
    };

    await expect(
      loginUser(
        {
          email: "pending@example.com",
          password: "example-password"
        },
        {
          supabaseClient,
          loadUserAccessProfile: vi.fn()
        }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "EMAIL_NOT_VERIFIED"
    });
  });

  it("resolves an authenticated user from a bearer token", async () => {
    const supabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email: "manager.demo@cloudcomputing.local",
              email_confirmed_at: "2026-03-26T03:00:00.000Z",
              last_sign_in_at: "2026-03-26T03:10:00.000Z",
              user_metadata: {
                first_name: "Maya",
                last_name: "Manager",
                job_title: "Operations Manager"
              },
              app_metadata: {
                app_role: "manager"
              }
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
              id: buildProfile().id,
              email: "manager.demo@cloudcomputing.local",
              user_metadata: {
                first_name: "Maya",
                last_name: "Manager"
              },
              app_metadata: {
                app_role: "manager"
              }
            }
          },
          error: null
        })
      }
    };

    await expect(
      resolveAuthenticatedUser("access-token", {
        supabaseClient,
        loadUserAccessProfile: vi.fn().mockResolvedValue(null),
        syncProfile: vi.fn().mockResolvedValue({})
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_NOT_PROVISIONED"
    });
  });

  it("rejects duplicate signup emails with a conflict error", async () => {
    const findUserByEmail = vi.fn().mockResolvedValue(buildProfile({
      email: "employee.one@cloudcomputing.local"
    }));

    await expect(
      signupUser(
        {
          email: "employee.one@cloudcomputing.local",
          password: "example-password",
          firstName: "Ethan",
          lastName: "Employee",
          appRole: "employee"
        },
        {
          anonSupabaseClient: { auth: { signUp: vi.fn() } },
          serviceRoleSupabaseClient: {
            auth: {
              admin: {
                updateUserById: vi.fn(),
                deleteUser: vi.fn()
              }
            }
          },
          findUserByEmail,
          syncProfile: vi.fn(),
          currentEnv: {
            authEmailRedirectTo: "http://localhost:5500"
          }
        }
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ACCOUNT_ALREADY_EXISTS"
    });
  });

  it("fails clearly when Supabase signup returns an immediate session", async () => {
    const anonSupabaseClient = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: buildProfile().id,
              email: "manager.new@tasktrail.local"
            },
            session: {
              access_token: "access-token"
            }
          },
          error: null
        })
      }
    };
    const deleteUser = vi.fn().mockResolvedValue({ data: {}, error: null });

    await expect(
      signupUser(
        {
          email: "manager.new@tasktrail.local",
          password: "example-password",
          firstName: "Maya",
          lastName: "Manager",
          appRole: "manager"
        },
        {
          anonSupabaseClient,
          serviceRoleSupabaseClient: {
            auth: {
              admin: {
                updateUserById: vi.fn(),
                deleteUser
              }
            }
          },
          findUserByEmail: vi.fn().mockResolvedValue(null),
          syncProfile: vi.fn(),
          currentEnv: {
            authEmailRedirectTo: "http://localhost:5500"
          }
        }
      )
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "AUTH_EMAIL_CONFIRMATION_NOT_ENABLED"
    });

    expect(deleteUser).toHaveBeenCalledWith(buildProfile().id);
  });
});
