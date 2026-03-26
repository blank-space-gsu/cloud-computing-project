import { APP_ROLES } from "../constants/roles.js";
import {
  getEmployeeDashboardSnapshot,
  getManagerDashboardSnapshot
} from "../repositories/dashboard.repository.js";
import { listTeamsForUser } from "./team.service.js";
import { createAppError } from "../utils/appError.js";

const createEmptyEmployeeDashboard = () => ({
  summary: {
    assignedTaskCount: 0,
    completedTaskCount: 0,
    inProgressTaskCount: 0,
    todoTaskCount: 0,
    blockedTaskCount: 0,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    averageProgressPercent: 0,
    totalEstimatedHours: 0,
    openEstimatedHours: 0,
    currentWeekTaskCount: 0,
    completionRate: 0
  },
  charts: {
    byStatus: [],
    byPriority: [],
    byWeek: []
  },
  tasks: {
    upcomingDeadlines: [],
    urgentTasks: []
  }
});

const createEmptyManagerDashboard = () => ({
  summary: {
    totalTaskCount: 0,
    completedTaskCount: 0,
    openTaskCount: 0,
    overdueTaskCount: 0,
    dueSoonTaskCount: 0,
    unassignedTaskCount: 0,
    urgentTaskCount: 0,
    averageProgressPercent: 0,
    completionRate: 0
  },
  charts: {
    byStatus: [],
    byPriority: [],
    workloadByEmployee: []
  },
  tasks: {
    upcomingDeadlines: [],
    urgentTasks: []
  }
});

export const getEmployeeDashboardForUser = async (
  authUser,
  { loadDashboard = getEmployeeDashboardSnapshot } = {}
) => {
  if (authUser.appRole !== APP_ROLES.EMPLOYEE) {
    throw createAppError({
      statusCode: 403,
      code: "EMPLOYEE_DASHBOARD_FORBIDDEN",
      message: "Only employees can access the employee dashboard endpoint."
    });
  }

  return loadDashboard({
    employeeUserId: authUser.id
  });
};

export const getManagerDashboardForUser = async (
  authUser,
  { teamId },
  {
    listTeams = listTeamsForUser,
    loadDashboard = getManagerDashboardSnapshot
  } = {}
) => {
  const visibleTeams = await listTeams(authUser);
  const manageableTeams = visibleTeams.filter((team) => team.canManageTeam);

  if (teamId) {
    const selectedTeam = manageableTeams.find((team) => team.id === teamId);

    if (!selectedTeam) {
      throw createAppError({
        statusCode: 404,
        code: "TEAM_NOT_FOUND",
        message: "Team not found or not manageable."
      });
    }
  }

  const selectedTeams = teamId
    ? manageableTeams.filter((team) => team.id === teamId)
    : manageableTeams;

  if (selectedTeams.length === 0) {
    return {
      selectedTeamId: teamId ?? null,
      teams: manageableTeams,
      ...createEmptyManagerDashboard()
    };
  }

  const dashboard = await loadDashboard({
    teamIds: selectedTeams.map((team) => team.id)
  });

  return {
    selectedTeamId: teamId ?? null,
    teams: selectedTeams,
    ...dashboard
  };
};
