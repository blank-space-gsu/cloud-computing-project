import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  listTasksForUser,
  createTaskForUser,
  getTaskByIdForUser,
  updateTaskForUser,
  deleteTaskForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  listTasksForUser: vi.fn(),
  createTaskForUser: vi.fn(),
  getTaskByIdForUser: vi.fn(),
  updateTaskForUser: vi.fn(),
  deleteTaskForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/task.service.js", () => ({
  listTasksForUser,
  createTaskForUser,
  getTaskByIdForUser,
  updateTaskForUser,
  deleteTaskForUser,
  assignTaskForUser: vi.fn()
}));

const { default: app } = await import("../../src/app.js");

const taskId = "123e4567-e89b-42d3-a456-426614174111";

describe("tasks routes", () => {
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

  it("lists tasks with pagination metadata", async () => {
    listTasksForUser.mockResolvedValue({
      tasks: [
        {
          id: taskId,
          title: "Prepare report"
        }
      ],
      total: 1
    });

    const response = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.tasks).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
  });

  it("creates a task for privileged users", async () => {
    createTaskForUser.mockResolvedValue({
      id: taskId,
      title: "Prepare report"
    });

    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        title: "Prepare report",
        weekStartDate: "2026-03-23"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.task.id).toBe(taskId);
  });

  it("rejects invalid task creation payloads", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", "Bearer access-token")
      .send({
        title: "",
        weekStartDate: "not-a-date"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects task creation when weekStartDate is not a valid Monday", async () => {
    const response = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", "Bearer access-token")
      .send({
        teamId: "123e4567-e89b-42d3-a456-426614174000",
        title: "Prepare report",
        weekStartDate: "2026-03-24"
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a task detail", async () => {
    getTaskByIdForUser.mockResolvedValue({
      id: taskId,
      title: "Prepare report"
    });

    const response = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.task.id).toBe(taskId);
  });

  it("validates the task id parameter", async () => {
    const response = await request(app)
      .get("/api/v1/tasks/not-a-uuid")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates a task", async () => {
    updateTaskForUser.mockResolvedValue({
      id: taskId,
      status: "completed"
    });

    const response = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Authorization", "Bearer access-token")
      .send({
        status: "completed"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.task.status).toBe("completed");
  });

  it("rejects invalid weekStartDate filters", async () => {
    const response = await request(app)
      .get("/api/v1/tasks?weekStartDate=2026-02-31")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("deletes a task", async () => {
    deleteTaskForUser.mockResolvedValue({
      taskId
    });

    const response = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.taskId).toBe(taskId);
  });
});
