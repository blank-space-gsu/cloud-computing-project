import { GOAL_SCOPES } from "../constants/goals.js";
import { APP_ROLES, PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  createEmptyGoalList,
  createGoal,
  findGoalByIdForScope,
  listGoalsForScope,
  updateGoalById
} from "../repositories/goal.repository.js";
import { findAccessibleTeamById, findTeamMemberUserById } from "../repositories/team.repository.js";
import { findUserAccessProfileById } from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";
import { listTeamsForUser } from "./team.service.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isEmployeeUser = (authUser) => authUser.appRole === APP_ROLES.EMPLOYEE;
const isPrivilegedUser = (authUser) => PRIVILEGED_ROLES.includes(authUser.appRole);

const mapTeamOption = (team) => ({
  id: team.id,
  name: team.name,
  description: team.description,
  membershipRole: team.membershipRole,
  canManageTeam: Boolean(team.canManageTeam)
});

const ensurePrivilegedGoalUser = (authUser, code, message) => {
  if (!isPrivilegedUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code,
      message
    });
  }
};

const getReadableTeams = (authUser, teams) => {
  if (isEmployeeUser(authUser)) {
    return teams;
  }

  if (isAdminUser(authUser)) {
    return teams;
  }

  return teams.filter((team) => team.canManageTeam);
};

const getWritableTeams = (authUser, teams) => {
  if (isAdminUser(authUser)) {
    return teams;
  }

  return teams.filter((team) => team.canManageTeam);
};

const createEmptyGoalResponse = ({
  selectedTeamId = null,
  selectedUserId = null,
  availableTeams = []
}) => ({
  selectedTeamId,
  selectedUserId,
  availableTeams: availableTeams.map(mapTeamOption),
  ...createEmptyGoalList()
});

const ensureTeamSelection = (teamId, teams, message) => {
  const team = teams.find((entry) => entry.id === teamId);

  if (!team) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message
    });
  }

  return team;
};

const ensureGoalConfiguration = (goal) => {
  const issues = [];

  if (goal.startDate > goal.endDate) {
    issues.push({
      field: "startDate",
      message: "startDate must be before or equal to endDate."
    });
  }

  if (goal.scope === GOAL_SCOPES.USER && !goal.targetUserId) {
    issues.push({
      field: "targetUserId",
      message: "targetUserId is required when scope is user."
    });
  }

  if (goal.scope === GOAL_SCOPES.TEAM && goal.targetUserId) {
    issues.push({
      field: "targetUserId",
      message: "targetUserId must be omitted when scope is team."
    });
  }

  if (issues.length > 0) {
    throw createAppError({
      statusCode: 400,
      code: "INVALID_GOAL_CONFIGURATION",
      message: "Goal configuration is invalid.",
      details: issues
    });
  }
};

const ensureVisibleTargetUser = async (
  userId,
  teams,
  { findUser = findUserAccessProfileById } = {}
) => {
  const user = await findUser(userId);

  if (!user || !user.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  const userTeamIds = new Set((user.teams ?? []).map((team) => team.teamId));
  const intersectedTeams = teams.filter((team) => userTeamIds.has(team.id));

  if (intersectedTeams.length === 0) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  return {
    user,
    intersectedTeams
  };
};

const ensureTargetUserForGoal = async (
  goal,
  { findTeamMemberUser = findTeamMemberUserById } = {}
) => {
  if (goal.scope === GOAL_SCOPES.TEAM) {
    return null;
  }

  const targetUser = await findTeamMemberUser({
    teamId: goal.teamId,
    userId: goal.targetUserId
  });

  if (!targetUser || !targetUser.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  if (targetUser.appRole !== APP_ROLES.EMPLOYEE) {
    throw createAppError({
      statusCode: 400,
      code: "INVALID_GOAL_TARGET_ROLE",
      message: "User-scoped goals can only target employees in this phase."
    });
  }

  return targetUser;
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
      message: "You do not have permission to manage goals for this team."
    });
  }

  return team;
};

export const listGoalsForUser = async (
  authUser,
  filters,
  {
    listTeams = listTeamsForUser,
    findUser = findUserAccessProfileById,
    loadGoals = listGoalsForScope
  } = {}
) => {
  const visibleTeams = await listTeams(authUser);
  const availableTeams = getReadableTeams(authUser, visibleTeams);

  if (filters.teamId) {
    ensureTeamSelection(
      filters.teamId,
      availableTeams,
      isEmployeeUser(authUser)
        ? "Team not found or not accessible."
        : "Team not found or not manageable."
    );
  }

  let selectedTeams = filters.teamId
    ? availableTeams.filter((team) => team.id === filters.teamId)
    : availableTeams;
  let selectedUserId = null;

  if (selectedTeams.length === 0) {
    return createEmptyGoalResponse({
      selectedTeamId: filters.teamId ?? null,
      availableTeams
    });
  }

  if (isEmployeeUser(authUser)) {
    const result = await loadGoals({
      teamIds: selectedTeams.map((team) => team.id),
      viewerUserId: authUser.id,
      onlyViewerRelevant: true,
      filters: {
        ...filters,
        userId: undefined
      }
    });

    return {
      selectedTeamId: filters.teamId ?? null,
      selectedUserId: null,
      availableTeams: availableTeams.map(mapTeamOption),
      ...result
    };
  }

  if (filters.userId) {
    const { user, intersectedTeams } = await ensureVisibleTargetUser(
      filters.userId,
      selectedTeams,
      { findUser }
    );

    selectedUserId = user.id;
    selectedTeams = intersectedTeams;
  }

  if (selectedTeams.length === 0) {
    return createEmptyGoalResponse({
      selectedTeamId: filters.teamId ?? null,
      selectedUserId,
      availableTeams
    });
  }

  const result = await loadGoals({
    teamIds: selectedTeams.map((team) => team.id),
    filters: {
      ...filters,
      userId: selectedUserId ?? undefined
    }
  });

  return {
    selectedTeamId: filters.teamId ?? null,
    selectedUserId,
    availableTeams: availableTeams.map(mapTeamOption),
    ...result
  };
};

export const createGoalForUser = async (
  authUser,
  input,
  {
    findTeam = findAccessibleTeamById,
    insertGoal = createGoal,
    findGoal = findGoalByIdForScope,
    findTeamMemberUser = findTeamMemberUserById
  } = {}
) => {
  ensurePrivilegedGoalUser(
    authUser,
    "GOAL_CREATION_FORBIDDEN",
    "Only managers and admins can create goals."
  );

  await ensureTeamManageable(authUser, input.teamId, { findTeam });

  const normalizedGoal = {
    ...input,
    targetUserId: input.scope === GOAL_SCOPES.TEAM ? null : input.targetUserId ?? null
  };

  ensureGoalConfiguration(normalizedGoal);
  await ensureTargetUserForGoal(normalizedGoal, { findTeamMemberUser });

  const goalId = await insertGoal({
    ...normalizedGoal,
    createdByUserId: authUser.id,
    updatedByUserId: authUser.id
  });

  return findGoal({
    goalId,
    teamIds: [normalizedGoal.teamId]
  });
};

export const updateGoalForUser = async (
  authUser,
  goalId,
  patch,
  {
    listTeams = listTeamsForUser,
    findGoal = findGoalByIdForScope,
    updateGoal = updateGoalById,
    findTeamMemberUser = findTeamMemberUserById
  } = {}
) => {
    ensurePrivilegedGoalUser(
      authUser,
      "GOAL_UPDATE_FORBIDDEN",
      "Only managers and admins can update goals."
    );

    const writableTeams = getWritableTeams(authUser, await listTeams(authUser));
    const existingGoal = await findGoal({
      goalId,
      teamIds: writableTeams.map((team) => team.id)
    });

    if (!existingGoal) {
      throw createAppError({
        statusCode: 404,
        code: "GOAL_NOT_FOUND",
        message: "Goal not found or not manageable."
      });
    }

    if (patch.teamId) {
      ensureTeamSelection(patch.teamId, writableTeams, "Team not found or not manageable.");
    }

    const mergedGoal = {
      teamId: patch.teamId ?? existingGoal.teamId,
      targetUserId: Object.hasOwn(patch, "targetUserId")
        ? patch.targetUserId
        : (existingGoal.targetUser?.id ?? null),
      title: patch.title ?? existingGoal.title,
      description: Object.hasOwn(patch, "description")
        ? patch.description
        : existingGoal.description,
      goalType: patch.goalType ?? existingGoal.goalType,
      scope: patch.scope ?? existingGoal.scope,
      period: patch.period ?? existingGoal.period,
      startDate: patch.startDate ?? existingGoal.startDate,
      endDate: patch.endDate ?? existingGoal.endDate,
      targetValue: patch.targetValue ?? existingGoal.targetValue,
      actualValue: patch.actualValue ?? existingGoal.actualValue,
      unit: patch.unit ?? existingGoal.unit,
      status: patch.status ?? existingGoal.status
    };

    if (mergedGoal.scope === GOAL_SCOPES.TEAM) {
      mergedGoal.targetUserId = null;
    }

    ensureGoalConfiguration(mergedGoal);
    await ensureTargetUserForGoal(mergedGoal, { findTeamMemberUser });

    await updateGoal(goalId, {
      ...mergedGoal,
      updatedByUserId: authUser.id
    });

    return findGoal({
      goalId,
      teamIds: [mergedGoal.teamId]
    });
};
