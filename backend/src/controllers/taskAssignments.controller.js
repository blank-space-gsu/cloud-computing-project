import { sendSuccess } from "../utils/apiResponse.js";
import { assignTaskForUser } from "../services/task.service.js";
import { createTaskAssignmentBodySchema } from "../validators/task.validator.js";

export const createTaskAssignmentHandler = async (request, response) => {
  const payload = createTaskAssignmentBodySchema.parse(request.body);
  const task = await assignTaskForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Task assigned successfully.",
    data: {
      task
    }
  });
};
