import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  createTeamMember,
  createTeamRecord,
  deleteTeamMemberById,
  findAccessibleTeamById,
  findTeamMemberUserById,
  listAccessibleTeams,
  listMembersForAccessibleTeam,
  updateTeamById,
  upsertTeamMember
} from "../repositories/team.repository.js";
import { findUserAccessProfileById } from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";
import { createTeamAddedNotification } from "./notification.service.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);

const decorateTeam = (team, authUser) => ({
  ...team,
  canManageTeam:
    isAdminUser(authUser) || team.membershipRole === "manager"
});

const ensurePrivilegedUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const ensureTeamManageable = async (
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

  if (!isAdminUser(authUser) && team.membershipRole !== "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGEMENT_FORBIDDEN",
      message: "You do not have permission to manage this team."
    });
  }

  return team;
};

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

export const createTeamForUser = async (
  authUser,
  input,
  {
    insertTeam = createTeamRecord,
    addCreatorMembership = upsertTeamMember,
    findTeam = findAccessibleTeamById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_CREATION_FORBIDDEN",
    "Only managers and admins can create teams."
  );

  const teamId = await insertTeam({
    name: input.name,
    description: input.description
  });

  await addCreatorMembership({
    teamId,
    userId: authUser.id,
    membershipRole: "manager"
  });

  return getTeamByIdForUser(authUser, teamId, { findTeam });
};

export const updateTeamForUser = async (
  authUser,
  teamId,
  patch,
  {
    findTeam = findAccessibleTeamById,
    updateTeam = updateTeamById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_UPDATE_FORBIDDEN",
    "Only managers and admins can update teams."
  );

  await ensureTeamManageable(authUser, teamId, { findTeam });
  await updateTeam(teamId, patch);

  return getTeamByIdForUser(authUser, teamId, { findTeam });
};

export const addTeamMemberForUser = async (
  authUser,
  teamId,
  input,
  {
    findTeam = findAccessibleTeamById,
    findMember = findTeamMemberUserById,
    findUser = findUserAccessProfileById,
    insertTeamMember = createTeamMember,
    notifyTeamAdded = createTeamAddedNotification
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_MEMBER_ADD_FORBIDDEN",
    "Only managers and admins can add team members."
  );

  await ensureTeamManageable(authUser, teamId, { findTeam });

  if (!isAdminUser(authUser) && input.membershipRole === "manager") {
    throw createAppError({
      statusCode: 403,
      code: "TEAM_MANAGER_MUTATION_FORBIDDEN",
      message: "Only admins can assign manager team memberships."
    });
  }

  const existingMembership = await findMember({
    teamId,
    userId: input.userId
  });

  if (existingMembership) {
    throw createAppError({
      statusCode: 409,
      code: "TEAM_MEMBERSHIP_EXISTS",
      message: "This user is already a member of the team."
    });
  }

  const user = await findUser(input.userId);

  if (!user || !user.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  await insertTeamMember({
    teamId,
    userId: input.userId,
    membershipRole: input.membershipRole
  });

  const member = await findMember({
    teamId,
    userId: input.userId
  });
  const team = await getTeamByIdForUser(authUser, teamId, { findTeam });

  await notifyTeamAdded({
    userId: input.userId,
    teamId,
    teamName: team.name
  });

  return {
    team,
    member
  };
};

export const removeTeamMemberForUser = async (
  authUser,
  teamId,
  userId,
  {
    findTeam = findAccessibleTeamById,
    findMember = findTeamMemberUserById,
    removeTeamMember = deleteTeamMemberById
  } = {}
) => {
  ensurePrivilegedUser(
    authUser,
    "TEAM_MEMBER_REMOVE_FORBIDDEN",
    "Only managers and admins can remove team members."
  );

  const team = await ensureTeamManageable(authUser, teamId, { findTeam });
  const member = await findMember({
    teamId,
    userId
  });

  if (!member) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBER_NOT_FOUND",
      message: "Team member not found."
    });
  }

  if (member.membershipRole === "manager") {
    if (!isAdminUser(authUser)) {
      throw createAppError({
        statusCode: 403,
        code: "TEAM_MANAGER_MUTATION_FORBIDDEN",
        message: "Only admins can remove manager team memberships."
      });
    }

    if (Number(team.managerCount ?? 0) <= 1) {
      throw createAppError({
        statusCode: 400,
        code: "LAST_TEAM_MANAGER_REQUIRED",
        message: "A team must keep at least one manager."
      });
    }
  }

  const removedMembership = await removeTeamMember({
    teamId,
    userId
  });

  if (!removedMembership) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_MEMBER_NOT_FOUND",
      message: "Team member not found."
    });
  }

  return {
    teamId,
    userId,
    membershipRole: removedMembership.membership_role
  };
};
