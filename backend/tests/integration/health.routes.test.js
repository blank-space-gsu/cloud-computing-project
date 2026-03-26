import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";

describe("Phase 0 health route", () => {
  it("returns a 200 response with the standard success envelope", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Backend service is healthy.");
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("workforce-task-management-backend");
    expect(typeof response.body.data.database.status).toBe("string");
    expect(response.body.meta.path).toBe("/api/v1/health");
    expect(response.body.meta.method).toBe("GET");
    expect(typeof response.body.meta.timestamp).toBe("string");
  });

  it("returns a structured JSON error for unknown routes", async () => {
    const response = await request(app).get("/api/v1/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toContain("Route not found");
    expect(response.body.error.details).toEqual([]);
    expect(response.body.meta.path).toBe("/api/v1/unknown-route");
    expect(response.body.meta.method).toBe("GET");
    expect(typeof response.body.meta.timestamp).toBe("string");
  });

  it("can be imported directly for testing without binding a port", async () => {
    expect(typeof app).toBe("function");

    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
  });
});
