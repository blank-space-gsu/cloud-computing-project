import { sendSuccess } from "../utils/apiResponse.js";
import {
  dismissNotificationForUser,
  listNotificationsForCurrentUser,
  markNotificationReadForUser
} from "../services/notification.service.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema
} from "../validators/notifications.validator.js";

export const listNotificationsHandler = async (request, response) => {
  const filters = listNotificationsQuerySchema.parse(request.query);
  const result = await listNotificationsForCurrentUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Notifications loaded successfully.",
    data: {
      notifications: result.notifications,
      unreadCount: result.unreadCount
    },
    meta: {
      count: result.notifications.length,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    }
  });
};

export const markNotificationReadHandler = async (request, response) => {
  const { notificationId } = notificationIdParamsSchema.parse(request.params);
  const notification = await markNotificationReadForUser(
    request.auth.user,
    notificationId
  );

  return sendSuccess(response, {
    message: "Notification marked as read.",
    data: {
      notification
    }
  });
};

export const dismissNotificationHandler = async (request, response) => {
  const { notificationId } = notificationIdParamsSchema.parse(request.params);
  const notification = await dismissNotificationForUser(
    request.auth.user,
    notificationId
  );

  return sendSuccess(response, {
    message: "Notification dismissed successfully.",
    data: {
      notification
    }
  });
};
