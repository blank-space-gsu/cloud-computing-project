import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  TASK_PRIORITIES,
  TASK_SORT_FIELDS,
  TASK_STATUSES
} from "../constants/tasks.js";
import { TASK_UPDATE_TYPES } from "../constants/taskUpdates.js";
import { getPool } from "../db/pool.js";
import {
  createTask,
  createTaskAssignment,
  createTaskUpdate,
  deactivateActiveTaskAssignment,
  deleteTaskById,
  findAssignableUserInTeam,
  findTaskByIdForActor,
  listAccessibleTasks,
  updateTaskById
} from "../repositories/task.repository.js";
import { findAccessibleTeamById } from "../repositories/team.repository.js";
import { createAppError } from "../utils/appError.js";
import { ensureRecurringTasksGeneratedForUser } from "./recurringTaskRule.service.js";

const TEAM_MANAGER_MEMBERSHIP_ROLE = "manager";
const EMPLOYEE_EDITABLE_FIELDS = new Set(["status", "progressPercent", "notes"]);
const TASK_UPDATE_TRACKED_FIELDS = new Set(["status", "progressPercent", "notes"]);

const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);
const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;

const ensurePrivilegedUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const ensureTeamCanBeManaged = async (
  authUser,
  teamId,
  { findTeam = findAccessibleTeamById } = {}
) => {
  const team = await findTeam({
    teamId,
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not accessible."
    });
  }

  if (!isAdminUser(authUser) && team.membershipRole !== TEAM_MANAGER_MEMBERSHIP_ROLE) {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGEMENT_FORBIDDEN",
      message: "You do not have permission to manage tasks for this team."
    });
  }

  return team;
};

const ensureTaskAccessible = async (
  authUser,
  taskId,
  { findTask = findTaskByIdForActor } = {}
) => {
  const task = await findTask({
    taskId,
    actorUserId: authUser.id,
    actorAppRole: authUser.appRole
  });

  if (!task) {
    throw createAppError({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
      message: "Task not found or not accessible."
    });
  }

  return task;
};

const buildTaskMutationPayload = (input, existingTask) => {
  const payload = { ...input };

  if (!Object.hasOwn(payload, "status") && !existingTask) {
    payload.status = TASK_STATUSES.TODO;
  }

  if (!Object.hasOwn(payload, "priority") && !existingTask) {
    payload.priority = TASK_PRIORITIES.MEDIUM;
  }

  if (!Object.hasOwn(payload, "progressPercent") && !existingTask) {
    payload.progressPercent = 0;
  }

  if (Object.hasOwn(payload, "status")) {
    if (payload.status === TASK_STATUSES.COMPLETED) {
      payload.completedAt = new Date().toISOString();
      payload.progressPercent = 100;
    } else {
      payload.completedAt = null;
    }
  }

  return payload;
};

const buildEmployeeTaskPatch = (patch) => {
  const providedFields = Object.keys(patch);
  const disallowedFields = providedFields.filter(
    (field) => !EMPLOYEE_EDITABLE_FIELDS.has(field)
  );

  if (disallowedFields.length > 0) {
    throw createAppError({
      statusCode: 403,
      code: "TASK_UPDATE_FORBIDDEN",
      message:
        "Employees can only update task status, progress percent, and notes.",
      details: disallowedFields.map((field) => ({
        field,
        message: "This field is not editable by employees."
      }))
    });
  }

  return patch;
};

const shouldTrackTaskUpdate = (patch) =>
  Object.keys(patch).some((field) => TASK_UPDATE_TRACKED_FIELDS.has(field));

const buildTrackedTaskState = (existingTask, patch) => ({
  statusAfter: Object.hasOwn(patch, "status") ? patch.status : existingTask.status,
  progressPercentAfter: Object.hasOwn(patch, "progressPercent")
    ? patch.progressPercent
    : existingTask.progressPercent,
  note: Object.hasOwn(patch, "notes") ? patch.notes : existingTask.notes
});

const runInTransaction = async (
  work,
  { pool = getPool() } = {}
) => {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const listTasksForUser = async (
  authUser,
  filters,
  {
    listTasks = listAccessibleTasks,
    ensureGenerated = ensureRecurringTasksGeneratedForUser
  } = {}
) => {
  const scopedFilters = {
    ...filters,
    sortBy: filters.sortBy ?? TASK_SORT_FIELDS.URGENCY,
    sortOrder: filters.sortOrder ?? "asc"
  };

  if (authUser.appRole === APP_ROLES.EMPLOYEE) {
    scopedFilters.assigneeUserId = authUser.id;
  }

  await ensureGenerated(authUser, scopedFilters);

  return listTasks({
    actorUserId: authUser.id,
    actorAppRole: authUser.appRole,
    filters: scopedFilters
  });
};

export const getTaskByIdForUser = async (
  authUser,
  taskId,
  { findTask = findTaskByIdForActor } = {}
) => ensureTaskAccessible(authUser, taskId, { findTask });

export const createTaskForUser = async (
  authUser,
  input,
  {
    findTeam = findAccessibleTeamById,
    insertTask = createTask,
    insertTaskUpdate = createTaskUpdate,
    runTransaction = runInTransaction,
    findTask = findTaskByIdForActor
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TASK_CREATION_FORBIDDEN",
    "Only managers and admins can create tasks."
  );

  await ensureTeamCanBeManaged(authUser, input.teamId, { findTeam });

  const taskPayload = buildTaskMutationPayload(input);
  const taskId = await runTransaction(async (client) => {
    const createdTaskId = await insertTask(
      {
        ...taskPayload,
        teamId: input.teamId,
        createdByUserId: authUser.id,
        updatedByUserId: authUser.id
      },
      { pool: client }
    );

    await insertTaskUpdate(
      {
        taskId: createdTaskId,
        updatedByUserId: authUser.id,
        updateType: TASK_UPDATE_TYPES.CREATED,
        statusAfter: taskPayload.status,
        progressPercentAfter: taskPayload.progressPercent,
        note: taskPayload.notes ?? null
      },
      { pool: client }
    );

    return createdTaskId;
  });

  return ensureTaskAccessible(authUser, taskId, { findTask });
};

export const updateTaskForUser = async (
  authUser,
  taskId,
  patch,
  {
    findTask = findTaskByIdForActor,
    updateTask = updateTaskById,
    insertTaskUpdate = createTaskUpdate,
    runTransaction = runInTransaction
  } = {}
) => {
  const existingTask = await ensureTaskAccessible(authUser, taskId, { findTask });

  const allowedPatch = isPrivilegedUser(authUser)
    ? patch
    : buildEmployeeTaskPatch(patch);
  const taskPayload = buildTaskMutationPayload(allowedPatch, true);
  const shouldPersistTaskUpdate = shouldTrackTaskUpdate(taskPayload);
  const trackedTaskState = buildTrackedTaskState(existingTask, taskPayload);
  const updateType = trackedTaskState.statusAfter === TASK_STATUSES.COMPLETED &&
    existingTask.status !== TASK_STATUSES.COMPLETED
    ? TASK_UPDATE_TYPES.COMPLETED
    : TASK_UPDATE_TYPES.UPDATED;

  await runTransaction(async (client) => {
    await updateTask(
      taskId,
      {
        ...taskPayload,
        updatedByUserId: authUser.id
      },
      { pool: client }
    );

    if (shouldPersistTaskUpdate) {
      await insertTaskUpdate(
        {
          taskId,
          updatedByUserId: authUser.id,
          updateType,
          ...trackedTaskState
        },
        { pool: client }
      );
    }
  });

  return ensureTaskAccessible(authUser, taskId, { findTask });
};

export const deleteTaskForUser = async (
  authUser,
  taskId,
  {
    findTask = findTaskByIdForActor,
    removeTask = deleteTaskById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TASK_DELETION_FORBIDDEN",
    "Only managers and admins can delete tasks."
  );

  await ensureTaskAccessible(authUser, taskId, { findTask });
  const deletedTaskId = await removeTask(taskId);

  if (!deletedTaskId) {
    throw createAppError({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
      message: "Task not found or not accessible."
    });
  }

  return {
    taskId: deletedTaskId
  };
};

export const assignTaskForUser = async (
  authUser,
  input,
  {
    findTask = findTaskByIdForActor,
    findAssignee = findAssignableUserInTeam,
    closeActiveAssignment = deactivateActiveTaskAssignment,
    insertTaskAssignment = createTaskAssignment,
    insertTaskUpdate = createTaskUpdate,
    updateTask = updateTaskById,
    runTransaction = runInTransaction
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TASK_ASSIGNMENT_FORBIDDEN",
    "Only managers and admins can assign tasks."
  );

  const task = await ensureTaskAccessible(authUser, input.taskId, { findTask });
  const assignee = await findAssignee({
    teamId: task.teamId,
    userId: input.assigneeUserId
  });

  if (!assignee || !assignee.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "ASSIGNEE_NOT_FOUND",
      message: "Assignee not found in the task team or is inactive."
    });
  }

  if (assignee.appRole !== APP_ROLES.EMPLOYEE) {
    throw createAppError({
      statusCode: 400,
      code: "INVALID_ASSIGNEE_ROLE",
      message: "Tasks can only be assigned to employees in this MVP."
    });
  }

  await runTransaction(async (client) => {
    await closeActiveAssignment(
      {
        taskId: input.taskId
      },
      { pool: client }
    );

    await insertTaskAssignment(
      {
        taskId: input.taskId,
        assigneeUserId: input.assigneeUserId,
        assignedByUserId: authUser.id,
        assignmentNote: input.assignmentNote
      },
      { pool: client }
    );

    await updateTask(
      input.taskId,
      {
        updatedByUserId: authUser.id
      },
      { pool: client }
    );

    await insertTaskUpdate(
      {
        taskId: input.taskId,
        updatedByUserId: authUser.id,
        updateType: TASK_UPDATE_TYPES.ASSIGNED,
        statusAfter: task.status,
        progressPercentAfter: task.progressPercent,
        note: input.assignmentNote ?? null,
        assigneeUserId: input.assigneeUserId
      },
      { pool: client }
    );
  });

  return ensureTaskAccessible(authUser, input.taskId, { findTask });
};
