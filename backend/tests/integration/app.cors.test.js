import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";

describe("app CORS configuration", () => {
  it("allows IPv6 loopback preflight requests for local frontend development", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://[::1]:5500")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://[::1]:5500");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });
});
