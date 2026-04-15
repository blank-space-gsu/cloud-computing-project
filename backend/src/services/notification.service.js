import { NOTIFICATION_TYPES } from "../constants/notifications.js";
import {
  createNotification,
  dismissNotificationById,
  listNotificationsForUser,
  markNotificationReadById
} from "../repositories/notification.repository.js";
import { listDueNotificationCandidatesForUser } from "../repositories/task.repository.js";
import { createAppError } from "../utils/appError.js";

const buildDueTaskNotification = (task, userId) => {
  const type = task.isOverdue
    ? NOTIFICATION_TYPES.TASK_OVERDUE
    : NOTIFICATION_TYPES.TASK_DUE_SOON;

  return {
    userId,
    type,
    title: task.isOverdue
      ? `Overdue task: ${task.title}`
      : `Task due soon: ${task.title}`,
    message: task.isOverdue
      ? "This assigned task is overdue and still needs attention."
      : "This assigned task is due within the next 48 hours.",
    taskId: task.id,
    teamId: task.teamId,
    dedupeKey: `${type}:${userId}:${task.id}:${task.dueAt ?? "no-due-date"}`
  };
};

export const createTeamAddedNotification = async (
  { userId, teamId, teamName },
  { insertNotification = createNotification } = {}
) =>
  insertNotification({
    userId,
    type: NOTIFICATION_TYPES.TEAM_ADDED,
    title: teamName ? `Added to team: ${teamName}` : "Added to a team",
    message: teamName
      ? `You were added to the ${teamName} team.`
      : "You were added to a new team.",
    teamId
  });

export const listNotificationsForCurrentUser = async (
  authUser,
  filters,
  {
    listDueTasks = listDueNotificationCandidatesForUser,
    insertNotification = createNotification,
    loadNotifications = listNotificationsForUser
  } = {}
) => {
  const dueTasks = await listDueTasks({
    userId: authUser.id
  });

  await Promise.all(
    dueTasks.map((task) =>
      insertNotification(buildDueTaskNotification(task, authUser.id))
    )
  );

  return loadNotifications({
    userId: authUser.id,
    includeDismissed: filters.includeDismissed,
    page: filters.page,
    limit: filters.limit
  });
};

export const markNotificationReadForUser = async (
  authUser,
  notificationId,
  { markRead = markNotificationReadById } = {}
) => {
  const notification = await markRead({
    notificationId,
    userId: authUser.id
  });

  if (!notification) {
    throw createAppError({
      statusCode: 404,
      code: "NOTIFICATION_NOT_FOUND",
      message: "Notification not found."
    });
  }

  return notification;
};

export const dismissNotificationForUser = async (
  authUser,
  notificationId,
  { dismissNotification = dismissNotificationById } = {}
) => {
  const notification = await dismissNotification({
    notificationId,
    userId: authUser.id
  });

  if (!notification) {
    throw createAppError({
      statusCode: 404,
      code: "NOTIFICATION_NOT_FOUND",
      message: "Notification not found."
    });
  }

  return notification;
};
