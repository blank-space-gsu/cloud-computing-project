import { describe, expect, it } from "vitest";
import { loadEnv } from "../../../src/config/env.js";

describe("environment configuration", () => {
  it("applies sensible defaults for local development", () => {
    const result = loadEnv({});

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
    expect(result.API_PREFIX).toBe("/api/v1");
    expect(result.frontendOrigins).toEqual([
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://[::1]:5500"
    ]);
    expect(result.authEmailRedirectTo).toBe("http://localhost:5500");
    expect(result.DATABASE_SSL_REJECT_UNAUTHORIZED).toBe(false);
  });

  it("splits comma-separated frontend origins into an array", () => {
    const result = loadEnv({
      FRONTEND_APP_ORIGIN: "http://localhost:5500, https://example.com "
    });

    expect(result.frontendOrigins).toHaveLength(4);
    expect(result.frontendOrigins).toEqual(expect.arrayContaining([
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      "http://[::1]:5500",
      "https://example.com"
    ]));
  });

  it("adds the localhost alias when the loopback IP is configured", () => {
    const result = loadEnv({
      FRONTEND_APP_ORIGIN: "http://127.0.0.1:5500"
    });

    expect(result.frontendOrigins).toEqual([
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://[::1]:5500"
    ]);
  });

  it("adds the other loopback aliases when the IPv6 loopback is configured", () => {
    const result = loadEnv({
      FRONTEND_APP_ORIGIN: "http://[::1]:5500"
    });

    expect(result.frontendOrigins).toEqual([
      "http://[::1]:5500",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ]);
  });

  it("allows an explicit auth email redirect override", () => {
    const result = loadEnv({
      FRONTEND_APP_ORIGIN: "http://localhost:5500",
      SUPABASE_AUTH_EMAIL_REDIRECT_TO: "http://localhost:5500/auth/confirm"
    });

    expect(result.authEmailRedirectTo).toBe("http://localhost:5500/auth/confirm");
  });

  it("requires an explicit production redirect URL", () => {
    expect(() => loadEnv({
      NODE_ENV: "production",
      FRONTEND_APP_ORIGIN: "https://tasktrail.site"
    })).toThrow(
      "SUPABASE_AUTH_EMAIL_REDIRECT_TO must be set explicitly in production."
    );
  });

  it("rejects loopback and non-https auth URLs in production", () => {
    expect(() => loadEnv({
      NODE_ENV: "production",
      FRONTEND_APP_ORIGIN: "http://localhost:5500",
      SUPABASE_AUTH_EMAIL_REDIRECT_TO: "http://localhost:5500"
    })).toThrow(
      "FRONTEND_APP_ORIGIN cannot include loopback origins in production"
    );
  });

  it("requires the production redirect origin to match an allowed frontend origin", () => {
    expect(() => loadEnv({
      NODE_ENV: "production",
      FRONTEND_APP_ORIGIN: "https://tasktrail.site",
      SUPABASE_AUTH_EMAIL_REDIRECT_TO: "https://auth.tasktrail.site/confirm"
    })).toThrow(
      "SUPABASE_AUTH_EMAIL_REDIRECT_TO must share an origin with FRONTEND_APP_ORIGIN in production."
    );
  });

  it("accepts explicit https TaskTrail production auth URLs", () => {
    const result = loadEnv({
      NODE_ENV: "production",
      FRONTEND_APP_ORIGIN: "https://tasktrail.site, https://www.tasktrail.site",
      SUPABASE_AUTH_EMAIL_REDIRECT_TO: "https://tasktrail.site"
    });

    expect(result.frontendOrigins).toEqual([
      "https://tasktrail.site",
      "https://www.tasktrail.site"
    ]);
    expect(result.authEmailRedirectTo).toBe("https://tasktrail.site");
  });

  it("throws a readable error when the API prefix is invalid", () => {
    expect(() => loadEnv({ API_PREFIX: "api/v1" })).toThrow(
      "API_PREFIX must start with '/'"
    );
  });
});
