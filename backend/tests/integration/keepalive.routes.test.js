import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAppError } from "../../src/utils/appError.js";

const { runKeepaliveCheck } = vi.hoisted(() => ({
  runKeepaliveCheck: vi.fn()
}));

vi.mock("../../src/services/keepalive.service.js", () => ({
  runKeepaliveCheck
}));

const { default: app } = await import("../../src/app.js");

describe("keepalive route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a standard success envelope for a connected database check", async () => {
    runKeepaliveCheck.mockResolvedValue({
      status: "ok",
      api: "alive",
      database: {
        status: "connected",
        check: "select_1",
        checkedAt: "2026-04-24T16:00:00.000Z"
      }
    });

    const response = await request(app).get("/api/v1/keepalive");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Keepalive check completed.");
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.database.status).toBe("connected");
    expect(response.body.meta.path).toBe("/api/v1/keepalive");
    expect(response.body.meta.method).toBe("GET");
  });

  it("returns a clear 503 when the database check fails", async () => {
    runKeepaliveCheck.mockRejectedValue(
      createAppError({
        statusCode: 503,
        code: "DATABASE_UNREACHABLE",
        message: "Keepalive database check failed."
      })
    );

    const response = await request(app).get("/api/v1/keepalive");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("DATABASE_UNREACHABLE");
    expect(response.body.meta.path).toBe("/api/v1/keepalive");
  });
});
