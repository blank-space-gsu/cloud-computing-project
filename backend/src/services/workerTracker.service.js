import { APP_ROLES } from "../constants/roles.js";
import {
  getWorkerTrackerTeamSummary,
  listWorkerTrackerMembers,
  listWorkerTrackerTasksForMember,
  listWorkerTrackerUnassignedTasks
} from "../repositories/workerTracker.repository.js";
import { ensureRecurringTasksGeneratedForUser } from "./recurringTaskRule.service.js";
import { listTeamsForUser } from "./team.service.js";
import { createAppError } from "../utils/appError.js";

const createEmptyTracker = (availableTeams = [], selectedTeamId = null) => ({
  availableTeams,
  selectedTeamId,
  selectedMemberUserId: null,
  team: null,
  summary: {
    completionPercent: 0,
    totalTaskCount: 0,
    openTaskCount: 0,
    completedTaskCount: 0,
    overdueTaskCount: 0,
    blockedTaskCount: 0,
    unassignedTaskCount: 0
  },
  members: [],
  selectedMember: null,
  tasks: [],
  unassignedTasks: []
});

const ensureManagerUser = (authUser) => {
  if (
    authUser.appRole !== APP_ROLES.MANAGER
    && authUser.appRole !== APP_ROLES.ADMIN
  ) {
    throw createAppError({
      statusCode: 403,
      code: "WORKER_TRACKER_FORBIDDEN",
      message: "Only managers and admins can access Worker Tracker."
    });
  }
};

export const getWorkerTrackerForUser = async (
  authUser,
  filters = {},
  {
    listTeams = listTeamsForUser,
    ensureGenerated = ensureRecurringTasksGeneratedForUser,
    loadTeamSummary = getWorkerTrackerTeamSummary,
    loadMembers = listWorkerTrackerMembers,
    loadTasksForMember = listWorkerTrackerTasksForMember,
    loadUnassignedTasks = listWorkerTrackerUnassignedTasks
  } = {}
) => {
  ensureManagerUser(authUser);

  const visibleTeams = await listTeams(authUser);
  const manageableTeams = visibleTeams.filter((team) => team.canManageTeam);

  if (manageableTeams.length === 0) {
    return createEmptyTracker([], filters.teamId ?? null);
  }

  if (filters.teamId && !manageableTeams.some((team) => team.id === filters.teamId)) {
    throw createAppError({
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found or not manageable."
    });
  }

  const selectedTeam =
    manageableTeams.find((team) => team.id === (filters.teamId ?? manageableTeams[0]?.id))
    ?? manageableTeams[0];

  await ensureGenerated(authUser, {
    teamId: selectedTeam.id
  });

  const [summary, members, unassignedTasks] = await Promise.all([
    loadTeamSummary({ teamId: selectedTeam.id }),
    loadMembers({ teamId: selectedTeam.id }),
    loadUnassignedTasks({ teamId: selectedTeam.id, limit: 5 })
  ]);

  let selectedMember = null;
  let tasks = [];

  if (filters.memberUserId) {
    selectedMember = members.find((member) => member.userId === filters.memberUserId) ?? null;

    if (!selectedMember) {
      throw createAppError({
        statusCode: 404,
        code: "TEAM_MEMBER_NOT_FOUND",
        message: "Team member not found in the selected team."
      });
    }

    tasks = await loadTasksForMember({
      teamId: selectedTeam.id,
      memberUserId: filters.memberUserId
    });
  }

  return {
    availableTeams: manageableTeams,
    selectedTeamId: selectedTeam.id,
    selectedMemberUserId: selectedMember?.userId ?? null,
    team: {
      id: selectedTeam.id,
      name: selectedTeam.name,
      description: selectedTeam.description ?? null,
      memberCount: selectedTeam.memberCount ?? 0,
      managerCount: selectedTeam.managerCount ?? 0
    },
    summary: summary ?? createEmptyTracker().summary,
    members,
    selectedMember,
    tasks,
    unassignedTasks
  };
};
