import { describe, expect, it, vi } from "vitest";
import {
  assignTaskForUser,
  createTaskForUser,
  deleteTaskForUser,
  listTasksForUser,
  updateTaskForUser
} from "../../../src/services/task.service.js";

const managerUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "manager"
};

const employeeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "employee"
};

const sampleTask = {
  id: "33333333-3333-4333-8333-333333333333",
  teamId: "44444444-4444-4444-8444-444444444444",
  title: "Prepare weekly report",
  status: "todo",
  priority: "high",
  progressPercent: 0,
  assignment: null
};

describe("task service", () => {
  it("forces employee task lists to their own assignee id", async () => {
    const listTasks = vi.fn().mockResolvedValue({
      tasks: [],
      total: 0
    });
    const ensureGenerated = vi.fn().mockResolvedValue({
      generatedCount: 0
    });

    await listTasksForUser(
      employeeUser,
      {
        assigneeUserId: "99999999-9999-4999-8999-999999999999",
        page: 1,
        limit: 25
      },
      { listTasks, ensureGenerated }
    );

    expect(ensureGenerated).toHaveBeenCalledWith(
      employeeUser,
      expect.objectContaining({
        assigneeUserId: employeeUser.id
      })
    );
    expect(listTasks).toHaveBeenCalledWith({
      actorUserId: employeeUser.id,
      actorAppRole: "employee",
      filters: expect.objectContaining({
        assigneeUserId: employeeUser.id
      })
    });
  });

  it("creates tasks for manageable teams as a manager", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: sampleTask.teamId,
      membershipRole: "manager"
    });
    const insertTask = vi.fn().mockResolvedValue(sampleTask.id);
    const insertTaskUpdate = vi.fn().mockResolvedValue(
      "aaaaaaa1-1111-4111-8111-111111111111"
    );
    const runTransaction = vi.fn().mockImplementation(async (work) => work({}));
    const findTask = vi.fn().mockResolvedValue(sampleTask);

    const result = await createTaskForUser(
      managerUser,
      {
        teamId: sampleTask.teamId,
        title: sampleTask.title,
        weekStartDate: "2026-03-23"
      },
      {
        findTeam,
        insertTask,
        insertTaskUpdate,
        runTransaction,
        findTask
      }
    );

    expect(runTransaction).toHaveBeenCalled();
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: sampleTask.teamId,
        title: sampleTask.title,
        status: "todo",
        priority: "medium",
        progressPercent: 0,
        createdByUserId: managerUser.id,
        updatedByUserId: managerUser.id
      }),
      {
        pool: {}
      }
    );
    expect(insertTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: sampleTask.id,
        updatedByUserId: managerUser.id,
        updateType: "created",
        statusAfter: "todo",
        progressPercentAfter: 0
      }),
      {
        pool: {}
      }
    );
    expect(result.id).toBe(sampleTask.id);
  });

  it("rejects task creation for employees", async () => {
    await expect(
      createTaskForUser(employeeUser, {
        teamId: sampleTask.teamId,
        title: sampleTask.title,
        weekStartDate: "2026-03-23"
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TASK_CREATION_FORBIDDEN"
    });
  });

  it("allows employees to update their own task status, progress, and notes", async () => {
    const findTask = vi.fn().mockResolvedValue({
      ...sampleTask,
      assignment: {
        assigneeUserId: employeeUser.id
      }
    });
    const updateTask = vi.fn().mockResolvedValue(sampleTask.id);
    const insertTaskUpdate = vi.fn().mockResolvedValue(
      "bbbbbbb2-2222-4222-8222-222222222222"
    );
    const runTransaction = vi.fn().mockImplementation(async (work) => work({}));

    await updateTaskForUser(
      employeeUser,
      sampleTask.id,
      {
        status: "completed",
        notes: "Finished and reviewed."
      },
      {
        findTask,
        updateTask,
        insertTaskUpdate,
        runTransaction
      }
    );

    expect(runTransaction).toHaveBeenCalled();
    expect(updateTask).toHaveBeenCalledWith(
      sampleTask.id,
      expect.objectContaining({
        status: "completed",
        notes: "Finished and reviewed.",
        progressPercent: 100,
        updatedByUserId: employeeUser.id,
        completedAt: expect.any(String)
      })
      ,
      {
        pool: {}
      }
    );
    expect(insertTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: sampleTask.id,
        updatedByUserId: employeeUser.id,
        updateType: "completed",
        statusAfter: "completed",
        progressPercentAfter: 100,
        note: "Finished and reviewed."
      }),
      {
        pool: {}
      }
    );
  });

  it("does not write task history for manager-only metadata edits", async () => {
    const findTask = vi.fn().mockResolvedValue(sampleTask);
    const updateTask = vi.fn().mockResolvedValue(sampleTask.id);
    const insertTaskUpdate = vi.fn();
    const runTransaction = vi.fn().mockImplementation(async (work) => work({}));

    await updateTaskForUser(
      managerUser,
      sampleTask.id,
      {
        title: "Updated task title"
      },
      {
        findTask,
        updateTask,
        insertTaskUpdate,
        runTransaction
      }
    );

    expect(updateTask).toHaveBeenCalled();
    expect(insertTaskUpdate).not.toHaveBeenCalled();
  });

  it("rejects employee updates to protected fields", async () => {
    const findTask = vi.fn().mockResolvedValue(sampleTask);

    await expect(
      updateTaskForUser(
        employeeUser,
        sampleTask.id,
        {
          title: "Renamed task"
        },
        {
          findTask
        }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "TASK_UPDATE_FORBIDDEN"
    });
  });

  it("allows managers to assign tasks to employees in the same team", async () => {
    const findTask = vi.fn().mockResolvedValue(sampleTask);
    const findAssignee = vi.fn().mockResolvedValue({
      id: employeeUser.id,
      appRole: "employee",
      isActive: true
    });
    const closeActiveAssignment = vi.fn().mockResolvedValue(1);
    const insertTaskAssignment = vi.fn().mockResolvedValue(
      "55555555-5555-4555-8555-555555555555"
    );
    const insertTaskUpdate = vi.fn().mockResolvedValue(
      "ccccccc3-3333-4333-8333-333333333333"
    );
    const updateTask = vi.fn().mockResolvedValue(sampleTask.id);
    const runTransaction = vi.fn().mockImplementation(async (work) => work({}));

    const result = await assignTaskForUser(
      managerUser,
      {
        taskId: sampleTask.id,
        assigneeUserId: employeeUser.id,
        assignmentNote: "Please finish before Friday."
      },
      {
        findTask,
        findAssignee,
        closeActiveAssignment,
        insertTaskAssignment,
        insertTaskUpdate,
        updateTask,
        runTransaction
      }
    );

    expect(runTransaction).toHaveBeenCalled();
    expect(insertTaskAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: sampleTask.id,
        assigneeUserId: employeeUser.id,
        assignedByUserId: managerUser.id,
        assignmentNote: "Please finish before Friday."
      }),
      {
        pool: {}
      }
    );
    expect(insertTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: sampleTask.id,
        updatedByUserId: managerUser.id,
        updateType: "assigned",
        statusAfter: sampleTask.status,
        progressPercentAfter: sampleTask.progressPercent,
        assigneeUserId: employeeUser.id,
        note: "Please finish before Friday."
      }),
      {
        pool: {}
      }
    );
    expect(result.id).toBe(sampleTask.id);
  });

  it("rejects non-employee assignees", async () => {
    const findTask = vi.fn().mockResolvedValue(sampleTask);
    const findAssignee = vi.fn().mockResolvedValue({
      id: managerUser.id,
      appRole: "manager",
      isActive: true
    });

    await expect(
      assignTaskForUser(
        managerUser,
        {
          taskId: sampleTask.id,
          assigneeUserId: managerUser.id
        },
        {
          findTask,
          findAssignee
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_ASSIGNEE_ROLE"
    });
  });

  it("rejects task deletion for employees", async () => {
    await expect(deleteTaskForUser(employeeUser, sampleTask.id)).rejects.toMatchObject({
      statusCode: 403,
      code: "TASK_DELETION_FORBIDDEN"
    });
  });

  it("fails gracefully when a task disappears before deletion completes", async () => {
    const findTask = vi.fn().mockResolvedValue(sampleTask);
    const removeTask = vi.fn().mockResolvedValue(null);

    await expect(
      deleteTaskForUser(managerUser, sampleTask.id, {
        findTask,
        removeTask
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TASK_NOT_FOUND"
    });
  });
});
