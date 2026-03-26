import { describe, expect, it, vi } from "vitest";
import {
  createAuthenticate,
  extractBearerToken
} from "../../../src/middleware/authenticate.js";

describe("authenticate middleware", () => {
  it("extracts a bearer token from the authorization header", () => {
    expect(extractBearerToken("Bearer token-123")).toBe("token-123");
  });

  it("accepts bearer tokens case-insensitively and with extra whitespace", () => {
    expect(extractBearerToken("   bearer    token-123   ")).toBe("token-123");
    expect(extractBearerToken("BEARER token-456")).toBe("token-456");
  });

  it("rejects a missing authorization header", () => {
    expect(() => extractBearerToken(undefined)).toThrow(
      "Authorization header is required."
    );
  });

  it("attaches the resolved auth context to the request", async () => {
    const resolveUserContext = vi.fn().mockResolvedValue({
      user: {
        id: "1",
        appRole: "manager"
      },
      accessToken: "token-123"
    });
    const middleware = createAuthenticate(resolveUserContext);
    const request = {
      headers: {
        authorization: "Bearer token-123"
      }
    };
    const next = vi.fn();

    await middleware(request, {}, next);

    expect(resolveUserContext).toHaveBeenCalledWith("token-123");
    expect(request.auth.user.appRole).toBe("manager");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
