import { APP_ROLES } from "../constants/roles.js";
import { HOURS_SORT_FIELDS } from "../constants/hours.js";
import {
  createHoursLog,
  findHoursLogByIdForScope,
  listHoursLogsForScope
} from "../repositories/hoursLogged.repository.js";
import { findTaskByIdForActor } from "../repositories/task.repository.js";
import { findAccessibleTeamById } from "../repositories/team.repository.js";
import { createAppError } from "../utils/appError.js";
import { listTeamsForUser } from "./team.service.js";

const isAdminUser = (authUser) => authUser.appRole === APP_ROLES.ADMIN;
const isManagerUser = (authUser) => authUser.appRole === APP_ROLES.MANAGER;

const createEmptyHoursLogList = () => ({
  hoursLogs: [],
  total: 0,
  summary: {
    entryCount: 0,
    totalHours: 0,
    currentWeekHours: 0,
    currentMonthHours: 0
  },
  charts: {
    byDate: []
  }
});

const ensureTeamAccessible = async (
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

  return team;
};

const ensureTaskAccessible = async (
  authUser,
  taskId,
  { findTask = findTaskByIdForActor } = {}
) => {
  const task = await findTask({
    taskId,
    actorUserId: authUser.id,
    actorAppRole: authUser.appRole
  });

  if (!task) {
    throw createAppError({
      statusCode: 404,
      code: "TASK_NOT_FOUND",
      message: "Task not found or not accessible."
    });
  }

  return task;
};

const getManageableTeamIds = async (
  authUser,
  { listTeams = listTeamsForUser } = {}
) => {
  if (!isManagerUser(authUser)) {
    return [];
  }

  const teams = await listTeams(authUser);
  return teams.filter((team) => team.canManageTeam).map((team) => team.id);
};

export const createHoursLogForUser = async (
  authUser,
  input,
  {
    findTeam = findAccessibleTeamById,
    findTask = findTaskByIdForActor,
    insertHoursLog = createHoursLog,
    findHoursLog = findHoursLogByIdForScope,
    listTeams = listTeamsForUser
  } = {}
) => {
  await ensureTeamAccessible(authUser, input.teamId, { findTeam });

  let manageableTeamIds = [];

  if (isManagerUser(authUser)) {
    manageableTeamIds = await getManageableTeamIds(authUser, { listTeams });

    if (!manageableTeamIds.includes(input.teamId)) {
      throw createAppError({
        statusCode: 404,
        code: "TEAM_NOT_FOUND",
        message: "Team not found or not manageable."
      });
    }
  }

  if (input.taskId) {
    const task = await ensureTaskAccessible(authUser, input.taskId, { findTask });

    if (task.teamId !== input.teamId) {
      throw createAppError({
        statusCode: 400,
        code: "HOURS_TASK_TEAM_MISMATCH",
        message: "The selected task does not belong to the selected team."
      });
    }
  }

  const hoursLogId = await insertHoursLog({
    userId: authUser.id,
    teamId: input.teamId,
    taskId: input.taskId ?? null,
    workDate: input.workDate,
    hours: input.hours,
    note: input.note ?? null,
    createdByUserId: authUser.id,
    updatedByUserId: authUser.id
  });

  return findHoursLog({
    hoursLogId,
    actorUserId: authUser.id,
    actorAppRole: authUser.appRole,
    manageableTeamIds
  });
};

export const listHoursLogsForUser = async (
  authUser,
  filters,
  {
    findTeam = findAccessibleTeamById,
    listTeams = listTeamsForUser,
    listHoursLogs = listHoursLogsForScope
  } = {}
) => {
  const scopedFilters = {
    ...filters,
    sortBy: filters.sortBy ?? HOURS_SORT_FIELDS.WORK_DATE,
    sortOrder: filters.sortOrder ?? "desc"
  };

  if (authUser.appRole === APP_ROLES.EMPLOYEE) {
    if (filters.teamId) {
      await ensureTeamAccessible(authUser, filters.teamId, { findTeam });
    }

    return listHoursLogs({
      actorUserId: authUser.id,
      actorAppRole: authUser.appRole,
      manageableTeamIds: [],
      filters: {
        ...scopedFilters,
        userId: authUser.id
      }
    });
  }

  if (isAdminUser(authUser)) {
    return listHoursLogs({
      actorUserId: authUser.id,
      actorAppRole: authUser.appRole,
      manageableTeamIds: [],
      filters: scopedFilters
    });
  }

  const manageableTeamIds = await getManageableTeamIds(authUser, { listTeams });

  if (filters.teamId) {
    if (!manageableTeamIds.includes(filters.teamId)) {
      throw createAppError({
        statusCode: 404,
        code: "TEAM_NOT_FOUND",
        message: "Team not found or not manageable."
      });
    }

    return listHoursLogs({
      actorUserId: authUser.id,
      actorAppRole: authUser.appRole,
      manageableTeamIds: [filters.teamId],
      filters: scopedFilters
    });
  }

  if (manageableTeamIds.length === 0) {
    return createEmptyHoursLogList();
  }

  return listHoursLogs({
    actorUserId: authUser.id,
    actorAppRole: authUser.appRole,
    manageableTeamIds,
    filters: scopedFilters
  });
};
