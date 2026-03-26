import { sendSuccess } from "../utils/apiResponse.js";
import {
  getTeamByIdForUser,
  listTeamMembersForUser,
  listTeamsForUser
} from "../services/team.service.js";
import { teamIdParamsSchema } from "../validators/team.validator.js";

export const listMyTeams = async (request, response) => {
  const teams = await listTeamsForUser(request.auth.user);

  return sendSuccess(response, {
    message: "Teams loaded successfully.",
    data: {
      teams
    },
    meta: {
      count: teams.length
    }
  });
};

export const getTeamById = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const team = await getTeamByIdForUser(request.auth.user, teamId);

  return sendSuccess(response, {
    message: "Team loaded successfully.",
    data: {
      team
    }
  });
};

export const listTeamMembers = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const result = await listTeamMembersForUser(request.auth.user, teamId);

  return sendSuccess(response, {
    message: "Team members loaded successfully.",
    data: result,
    meta: {
      count: result.members.length
    }
  });
};
