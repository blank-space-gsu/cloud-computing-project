import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../../src/middleware/errorHandler.js";

const createResponseDouble = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
};

describe("error handler", () => {
  it("maps malformed JSON body errors to INVALID_JSON", () => {
    const response = createResponseDouble();
    const error = new SyntaxError("Unexpected end of JSON input");
    error.status = 400;
    error.type = "entity.parse.failed";
    error.body = '{"email":';

    errorHandler(error, { originalUrl: "/api/v1/auth/login", method: "POST" }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_JSON"
        })
      })
    );
  });

  it("maps known Postgres constraint errors to API-friendly responses", () => {
    const response = createResponseDouble();
    const error = {
      code: "23505",
      detail: "Key (task_id)=(abc) already exists."
    };

    errorHandler(error, { originalUrl: "/api/v1/task-assignments", method: "POST" }, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "CONFLICT",
          details: [
            {
              message: "Key (task_id)=(abc) already exists."
            }
          ]
        })
      })
    );
  });
});
