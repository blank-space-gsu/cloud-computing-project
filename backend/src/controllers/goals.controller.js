import { sendSuccess } from "../utils/apiResponse.js";
import {
  createGoalForUser,
  listGoalsForUser,
  updateGoalForUser
} from "../services/goal.service.js";
import {
  createGoalBodySchema,
  goalIdParamsSchema,
  listGoalsQuerySchema,
  updateGoalBodySchema
} from "../validators/goals.validator.js";

export const listGoalsHandler = async (request, response) => {
  const filters = listGoalsQuerySchema.parse(request.query);
  const result = await listGoalsForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Goals loaded successfully.",
    data: {
      selectedTeamId: result.selectedTeamId,
      selectedUserId: result.selectedUserId,
      availableTeams: result.availableTeams,
      goals: result.goals,
      summary: result.summary,
      charts: result.charts
    },
    meta: {
      count: result.goals.length,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    }
  });
};

export const createGoalHandler = async (request, response) => {
  const payload = createGoalBodySchema.parse(request.body);
  const goal = await createGoalForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Goal created successfully.",
    data: {
      goal
    }
  });
};

export const updateGoalHandler = async (request, response) => {
  const { goalId } = goalIdParamsSchema.parse(request.params);
  const patch = updateGoalBodySchema.parse(request.body);
  const goal = await updateGoalForUser(request.auth.user, goalId, patch);

  return sendSuccess(response, {
    message: "Goal updated successfully.",
    data: {
      goal
    }
  });
};
