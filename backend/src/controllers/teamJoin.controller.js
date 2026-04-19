import { sendSuccess } from "../utils/apiResponse.js";
import { TEAM_MEMBERSHIP_ROLES } from "../constants/teamMemberships.js";
import { joinTeamForUser } from "../services/team.service.js";
import { teamJoinBodySchema } from "../validators/teamJoin.validator.js";

export const joinTeamHandler = async (request, response) => {
  const payload = teamJoinBodySchema.parse(request.body);
  const result = await joinTeamForUser(request.auth.user, payload);

  const successMessage = result.rejoined
    ? "Team membership reactivated successfully."
    : result.membership.membershipRole === TEAM_MEMBERSHIP_ROLES.MANAGER
      ? "Manager team access activated successfully."
      : "Team joined successfully.";

  return sendSuccess(response, {
    statusCode: 201,
    message: successMessage,
    data: result
  });
};
