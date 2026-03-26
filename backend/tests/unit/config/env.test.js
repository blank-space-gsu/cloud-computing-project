import { describe, expect, it } from "vitest";
import { loadEnv } from "../../../src/config/env.js";

describe("environment configuration", () => {
  it("applies sensible defaults for local development", () => {
    const result = loadEnv({});

    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
    expect(result.API_PREFIX).toBe("/api/v1");
    expect(result.frontendOrigins).toEqual(["http://localhost:5500"]);
    expect(result.DATABASE_SSL_REJECT_UNAUTHORIZED).toBe(false);
  });

  it("splits comma-separated frontend origins into an array", () => {
    const result = loadEnv({
      FRONTEND_APP_ORIGIN: "http://localhost:5500, https://example.com "
    });

    expect(result.frontendOrigins).toEqual([
      "http://localhost:5500",
      "https://example.com"
    ]);
  });

  it("throws a readable error when the API prefix is invalid", () => {
    expect(() => loadEnv({ API_PREFIX: "api/v1" })).toThrow(
      "API_PREFIX must start with '/'"
    );
  });
});
