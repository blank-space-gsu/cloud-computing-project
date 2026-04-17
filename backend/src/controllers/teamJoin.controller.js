import { sendSuccess } from "../utils/apiResponse.js";
import { joinTeamForUser } from "../services/team.service.js";
import { teamJoinBodySchema } from "../validators/teamJoin.validator.js";

export const joinTeamHandler = async (request, response) => {
  const payload = teamJoinBodySchema.parse(request.body);
  const result = await joinTeamForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: result.rejoined
      ? "Team membership reactivated successfully."
      : "Team joined successfully.",
    data: result
  });
};
