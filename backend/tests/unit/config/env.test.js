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

  it("throws a readable error when the API prefix is invalid", () => {
    expect(() => loadEnv({ API_PREFIX: "api/v1" })).toThrow(
      "API_PREFIX must start with '/'"
    );
  });
});
