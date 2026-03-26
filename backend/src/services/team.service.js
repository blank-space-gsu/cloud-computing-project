import { APP_ROLES } from "../constants/roles.js";
import {
  findAccessibleTeamById,
  listAccessibleTeams,
  listMembersForAccessibleTeam
} from "../repositories/team.repository.js";
import { createAppError } from "../utils/appError.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;

const decorateTeam = (team, authUser) => ({
  ...team,
  canManageTeam:
    isAdminUser(authUser) || team.membershipRole === "manager"
});

export const listTeamsForUser = async (
  authUser,
  { listTeams = listAccessibleTeams } = {}
) => {
  const teams = await listTeams({
    requestingUserId: authUser.id,
    isAdmin: isAdminUser(authUser)
  });

  return teams.map((team) => decorateTeam(team, authUser));
};

export const getTeamByIdForUser = async (
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

  return decorateTeam(team, authUser);
};

export const listTeamMembersForUser = async (
  authUser,
  teamId,
  {
    findTeam = findAccessibleTeamById,
    listMembers = listMembersForAccessibleTeam
  } = {}
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

  return {
    team: decorateTeam(team, authUser),
    members: await listMembers({ teamId })
  };
};
