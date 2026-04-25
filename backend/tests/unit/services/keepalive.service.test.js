import { describe, expect, it, vi } from "vitest";
import { runKeepaliveCheck } from "../../../src/services/keepalive.service.js";

describe("keepalive service", () => {
  it("returns a connected result after a tiny database query", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          keepalive: 1,
          checked_at: "2026-04-24T16:00:00.000Z"
        }
      ]
    });
    const poolFactory = vi.fn(() => ({ query }));

    const result = await runKeepaliveCheck({
      currentEnv: {
        DATABASE_URL: "postgresql://example"
      },
      poolFactory
    });

    expect(poolFactory).toHaveBeenCalledWith({
      DATABASE_URL: "postgresql://example"
    });
    expect(query).toHaveBeenCalledWith(
      "select 1 as keepalive, now() at time zone 'utc' as checked_at"
    );
    expect(result).toEqual({
      status: "ok",
      api: "alive",
      database: {
        status: "connected",
        check: "select_1",
        checkedAt: "2026-04-24T16:00:00.000Z"
      }
    });
  });

  it("fails clearly when the database is not configured", async () => {
    await expect(
      runKeepaliveCheck({
        currentEnv: {
          DATABASE_URL: ""
        }
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "DATABASE_NOT_CONFIGURED"
    });
  });

  it("fails clearly when the tiny database query fails", async () => {
    const poolFactory = vi.fn(() => ({
      query: vi.fn().mockRejectedValue(new Error("connection failed"))
    }));

    await expect(
      runKeepaliveCheck({
        currentEnv: {
          DATABASE_URL: "postgresql://example"
        },
        poolFactory
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "DATABASE_UNREACHABLE"
    });
  });
});
