import { sendSuccess } from "../utils/apiResponse.js";
import {
  addTeamMemberForUser,
  createTeamForUser,
  getTeamJoinAccessForUser,
  getTeamByIdForUser,
  leaveTeamForUser,
  listTeamMembersForUser,
  listTeamsForUser,
  regenerateTeamJoinAccessForUser,
  removeTeamMemberForUser,
  updateTeamForUser
} from "../services/team.service.js";
import {
  addTeamMemberBodySchema,
  createTeamBodySchema,
  regenerateTeamJoinAccessBodySchema,
  teamIdParamsSchema,
  teamMemberParamsSchema,
  updateTeamBodySchema
} from "../validators/team.validator.js";

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

export const createTeamHandler = async (request, response) => {
  const payload = createTeamBodySchema.parse(request.body);
  const team = await createTeamForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Team created successfully.",
    data: {
      team
    }
  });
};

export const updateTeamHandler = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const payload = updateTeamBodySchema.parse(request.body);
  const team = await updateTeamForUser(request.auth.user, teamId, payload);

  return sendSuccess(response, {
    message: "Team updated successfully.",
    data: {
      team
    }
  });
};

export const addTeamMemberHandler = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const payload = addTeamMemberBodySchema.parse(request.body);
  const result = await addTeamMemberForUser(request.auth.user, teamId, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Team member added successfully.",
    data: result
  });
};

export const removeTeamMemberHandler = async (request, response) => {
  const { teamId, userId } = teamMemberParamsSchema.parse(request.params);
  const result = await removeTeamMemberForUser(request.auth.user, teamId, userId);

  return sendSuccess(response, {
    message: "Team member removed successfully.",
    data: result
  });
};

export const getTeamJoinAccessHandler = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const result = await getTeamJoinAccessForUser(request.auth.user, teamId);

  return sendSuccess(response, {
    message: "Team join access loaded successfully.",
    data: result
  });
};

export const regenerateTeamJoinAccessHandler = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const payload = regenerateTeamJoinAccessBodySchema.parse(request.body ?? {});
  const result = await regenerateTeamJoinAccessForUser(
    request.auth.user,
    teamId,
    payload
  );

  return sendSuccess(response, {
    message: "Team join access regenerated successfully.",
    data: result
  });
};

export const leaveMyTeamHandler = async (request, response) => {
  const { teamId } = teamIdParamsSchema.parse(request.params);
  const result = await leaveTeamForUser(request.auth.user, teamId);

  return sendSuccess(response, {
    message: "Team membership left successfully.",
    data: result
  });
};
