import { describe, expect, it, vi } from "vitest";
import { authorizeRoles } from "../../../src/middleware/authorizeRoles.js";

describe("authorizeRoles middleware", () => {
  it("allows a user whose role is permitted", () => {
    const middleware = authorizeRoles("manager", "admin");
    const next = vi.fn();

    middleware(
      {
        auth: {
          user: {
            appRole: "manager"
          }
        }
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects a request with no authenticated user", () => {
    const middleware = authorizeRoles("manager");

    expect(() => middleware({}, {}, vi.fn())).toThrow(
      "Authentication is required before checking roles."
    );
  });

  it("rejects a user whose role is not permitted", () => {
    const middleware = authorizeRoles("manager");

    expect(() =>
      middleware(
        {
          auth: {
            user: {
              appRole: "employee"
            }
          }
        },
        {},
        vi.fn()
      )
    ).toThrow("You do not have permission to access this resource.");
  });
});
