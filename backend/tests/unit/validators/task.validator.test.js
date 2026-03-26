import { describe, expect, it } from "vitest";
import {
  createTaskBodySchema,
  listTasksQuerySchema,
  updateTaskBodySchema
} from "../../../src/validators/task.validator.js";

describe("task validator", () => {
  it("rejects invalid calendar dates for weekStartDate", () => {
    const result = createTaskBodySchema.safeParse({
      teamId: "123e4567-e89b-42d3-a456-426614174000",
      title: "Prepare report",
      weekStartDate: "2026-02-31"
    });

    expect(result.success).toBe(false);
  });

  it("rejects weekStartDate values that are not Mondays", () => {
    const createResult = createTaskBodySchema.safeParse({
      teamId: "123e4567-e89b-42d3-a456-426614174000",
      title: "Prepare report",
      weekStartDate: "2026-03-24"
    });
    const queryResult = listTasksQuerySchema.safeParse({
      weekStartDate: "2026-03-24"
    });
    const updateResult = updateTaskBodySchema.safeParse({
      weekStartDate: "2026-03-24"
    });

    expect(createResult.success).toBe(false);
    expect(queryResult.success).toBe(false);
    expect(updateResult.success).toBe(false);
  });

  it("accepts valid Monday weekStartDate values", () => {
    const result = createTaskBodySchema.safeParse({
      teamId: "123e4567-e89b-42d3-a456-426614174000",
      title: "Prepare report",
      weekStartDate: "2026-03-23"
    });

    expect(result.success).toBe(true);
  });
});
