import { PRODUCTIVITY_SCOPES } from "../constants/productivity.js";
import { APP_ROLES } from "../constants/roles.js";
import {
  createEmptyProductivitySnapshot,
  getProductivitySnapshot
} from "../repositories/productivity.repository.js";
import { findUserAccessProfileById } from "../repositories/user.repository.js";
import { createAppError } from "../utils/appError.js";
import {
  buildProductivityRanges,
  getTodayIsoDate
} from "../utils/productivityPeriods.js";
import { listTeamsForUser } from "./team.service.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isEmployeeUser = (authUser) => authUser.appRole === APP_ROLES.EMPLOYEE;

const getDefaultScope = (authUser, filters) => {
  if (filters.scope) {
    return filters.scope;
  }

  if (filters.userId) {
    return PRODUCTIVITY_SCOPES.INDIVIDUAL;
  }

  return isEmployeeUser(authUser)
    ? PRODUCTIVITY_SCOPES.INDIVIDUAL
    : PRODUCTIVITY_SCOPES.TEAM;
};

const mapTeamOption = (team) => ({
  id: team.id,
  name: team.name,
  description: team.description,
  membershipRole: team.membershipRole,
  canManageTeam: Boolean(team.canManageTeam)
});

const mapUserSummary = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  jobTitle: user.jobTitle,
  appRole: user.appRole,
  isActive: user.isActive
});

const buildMetricsResponse = ({
  scope,
  referenceDate,
  selectedTeamId,
  availableTeams,
  user = null,
  snapshot
}) => ({
  scope,
  referenceDate,
  selectedTeamId,
  availableTeams: availableTeams.map(mapTeamOption),
  user,
  ...snapshot
});

const getRelevantVisibleTeams = (authUser, teams) => {
  if (isEmployeeUser(authUser)) {
    return teams;
  }

  if (isAdminUser(authUser)) {
    return teams;
  }

  return teams.filter((team) => team.canManageTeam);
};

const getIntersectionTeams = (candidateTeams, targetUser) => {
  const targetTeamIds = new Set((targetUser.teams ?? []).map((team) => team.teamId));

  return candidateTeams.filter((team) => targetTeamIds.has(team.id));
};

const ensureAccessibleUserProfile = async (
  targetUserId,
  { findUser = findUserAccessProfileById } = {}
) => {
  const targetUser = await findUser(targetUserId);

  if (!targetUser || !targetUser.isActive) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  return targetUser;
};

const ensureSelectedTeam = (teamId, teams, message = "Team not found or not accessible.") => {
  const selectedTeam = teams.find((team) => team.id === teamId);

  if (!selectedTeam) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message
    });
  }

  return selectedTeam;
};

export const getProductivityMetricsForUser = async (
  authUser,
  filters,
  {
    listTeams = listTeamsForUser,
    findUser = findUserAccessProfileById,
    loadSnapshot = getProductivitySnapshot
  } = {}
) => {
  const referenceDate = filters.referenceDate ?? getTodayIsoDate();
  const requestedScope = getDefaultScope(authUser, filters);
  const ranges = buildProductivityRanges(referenceDate);
  const visibleTeams = await listTeams(authUser);

  if (requestedScope === PRODUCTIVITY_SCOPES.TEAM && isEmployeeUser(authUser)) {
    throw createAppError({
      statusCode: 403,
      code: "PRODUCTIVITY_SCOPE_FORBIDDEN",
      message: "Employees can only access their own individual productivity metrics."
    });
  }

  if (requestedScope === PRODUCTIVITY_SCOPES.TEAM) {
    const availableTeams = getRelevantVisibleTeams(authUser, visibleTeams);

    if (filters.teamId) {
      ensureSelectedTeam(filters.teamId, availableTeams, "Team not found or not manageable.");
    }

    const selectedTeamIds = filters.teamId
      ? [filters.teamId]
      : availableTeams.map((team) => team.id);

    if (selectedTeamIds.length === 0) {
      return buildMetricsResponse({
        scope: requestedScope,
        referenceDate,
        selectedTeamId: filters.teamId ?? null,
        availableTeams,
        snapshot: createEmptyProductivitySnapshot(ranges)
      });
    }

    const snapshot = await loadSnapshot({
      teamIds: selectedTeamIds,
      ranges,
      includeMemberBreakdown: true
    });

    return buildMetricsResponse({
      scope: requestedScope,
      referenceDate,
      selectedTeamId: filters.teamId ?? null,
      availableTeams,
      snapshot
    });
  }

  const targetUserId = isEmployeeUser(authUser) ? authUser.id : filters.userId ?? authUser.id;
  const targetUser = await ensureAccessibleUserProfile(targetUserId, { findUser });
  const candidateTeams = getRelevantVisibleTeams(authUser, visibleTeams);
  let availableTeams = getIntersectionTeams(candidateTeams, targetUser);

  if (filters.teamId) {
    ensureSelectedTeam(
      filters.teamId,
      candidateTeams,
      isEmployeeUser(authUser)
        ? "Team not found or not accessible."
        : "Team not found or not manageable."
    );

    if (!availableTeams.some((team) => team.id === filters.teamId)) {
      throw createAppError({
        statusCode: 404,
        code: "USER_NOT_FOUND",
        message: "User not found or not accessible."
      });
    }

    availableTeams = availableTeams.filter((team) => team.id === filters.teamId);
  }

  if (
    !isEmployeeUser(authUser) &&
    targetUserId !== authUser.id &&
    availableTeams.length === 0
  ) {
    throw createAppError({
      statusCode: 404,
      code: "USER_NOT_FOUND",
      message: "User not found or not accessible."
    });
  }

  if (availableTeams.length === 0) {
    return buildMetricsResponse({
      scope: requestedScope,
      referenceDate,
      selectedTeamId: filters.teamId ?? null,
      availableTeams,
      user: mapUserSummary(targetUser),
      snapshot: createEmptyProductivitySnapshot(ranges)
    });
  }

  const snapshot = await loadSnapshot({
    teamIds: availableTeams.map((team) => team.id),
    userId: targetUser.id,
    ranges,
    includeMemberBreakdown: false
  });

  return buildMetricsResponse({
    scope: requestedScope,
    referenceDate,
    selectedTeamId: filters.teamId ?? null,
    availableTeams,
    user: mapUserSummary(targetUser),
    snapshot
  });
};
