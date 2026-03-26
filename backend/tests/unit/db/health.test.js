import { describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth } from "../../../src/db/health.js";

describe("database health checks", () => {
  it("returns not_configured when DATABASE_URL is missing", async () => {
    const result = await checkDatabaseHealth({
      currentEnv: {
        DATABASE_URL: ""
      }
    });

    expect(result).toEqual({
      status: "not_configured"
    });
  });

  it("returns connected when the pool query succeeds", async () => {
    const poolFactory = vi.fn(() => ({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            database_name: "postgres",
            checked_at: "2026-03-26T03:30:00.000Z"
          }
        ]
      })
    }));

    const result = await checkDatabaseHealth({
      currentEnv: {
        DATABASE_URL: "postgresql://example"
      },
      poolFactory
    });

    expect(result).toEqual({
      status: "connected",
      databaseName: "postgres",
      checkedAt: "2026-03-26T03:30:00.000Z"
    });
  });

  it("returns unreachable when the database query fails", async () => {
    const poolFactory = vi.fn(() => ({
      query: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"))
    }));

    const result = await checkDatabaseHealth({
      currentEnv: {
        DATABASE_URL: "postgresql://example"
      },
      poolFactory
    });

    expect(result).toEqual({
      status: "unreachable",
      message: "connect ECONNREFUSED"
    });
  });
});
