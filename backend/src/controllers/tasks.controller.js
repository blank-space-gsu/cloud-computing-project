import { sendSuccess } from "../utils/apiResponse.js";
import {
  createTaskForUser,
  deleteTaskForUser,
  getTaskByIdForUser,
  listTasksForUser,
  updateTaskForUser
} from "../services/task.service.js";
import {
  createTaskBodySchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskBodySchema
} from "../validators/task.validator.js";

export const listTasks = async (request, response) => {
  const filters = listTasksQuerySchema.parse(request.query);
  const result = await listTasksForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Tasks loaded successfully.",
    data: {
      tasks: result.tasks
    },
    meta: {
      count: result.tasks.length,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    }
  });
};

export const createTaskHandler = async (request, response) => {
  const payload = createTaskBodySchema.parse(request.body);
  const task = await createTaskForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Task created successfully.",
    data: {
      task
    }
  });
};

export const getTaskById = async (request, response) => {
  const { taskId } = taskIdParamsSchema.parse(request.params);
  const task = await getTaskByIdForUser(request.auth.user, taskId);

  return sendSuccess(response, {
    message: "Task loaded successfully.",
    data: {
      task
    }
  });
};

export const updateTaskHandler = async (request, response) => {
  const { taskId } = taskIdParamsSchema.parse(request.params);
  const patch = updateTaskBodySchema.parse(request.body);
  const task = await updateTaskForUser(request.auth.user, taskId, patch);

  return sendSuccess(response, {
    message: "Task updated successfully.",
    data: {
      task
    }
  });
};

export const deleteTaskHandler = async (request, response) => {
  const { taskId } = taskIdParamsSchema.parse(request.params);
  const result = await deleteTaskForUser(request.auth.user, taskId);

  return sendSuccess(response, {
    message: "Task deleted successfully.",
    data: result
  });
};
