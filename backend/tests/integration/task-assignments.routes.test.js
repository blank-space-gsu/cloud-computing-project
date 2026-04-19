import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthenticatedUser, assignTaskForUser } = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  assignTaskForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  signupUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/task.service.js", () => ({
  listTasksForUser: vi.fn(),
  createTaskForUser: vi.fn(),
  getTaskByIdForUser: vi.fn(),
  updateTaskForUser: vi.fn(),
  deleteTaskForUser: vi.fn(),
  assignTaskForUser
}));

const { default: app } = await import("../../src/app.js");

describe("task assignment routes", () => {
  const taskId = "123e4567-e89b-42d3-a456-426614174111";
  const assigneeUserId = "123e4567-e89b-42d3-a456-426614174222";

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: "manager.demo@cloudcomputing.local",
        fullName: "Maya Manager",
        appRole: "manager",
        teams: []
      },
      accessToken: "access-token"
    });
  });

  it("assigns a task for a manager", async () => {
    assignTaskForUser.mockResolvedValue({
      id: taskId,
      assignment: {
        assigneeUserId
      }
    });

    const response = await request(app)
      .post("/api/v1/task-assignments")
      .set("Authorization", "Bearer access-token")
      .send({
        taskId,
        assigneeUserId,
        assignmentNote: "Please finish by Thursday."
      });

    expect(response.status).toBe(201);
    expect(response.body.data.task.assignment.assigneeUserId).toBe(assigneeUserId);
  });

  it("rejects invalid assignment payloads", async () => {
    const response = await request(app)
      .post("/api/v1/task-assignments")
      .set("Authorization", "Bearer access-token")
      .send({
        taskId: "not-a-uuid"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("blocks employees from assigning tasks", async () => {
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });

    const response = await request(app)
      .post("/api/v1/task-assignments")
      .set("Authorization", "Bearer access-token")
      .send({
        taskId,
        assigneeUserId
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
