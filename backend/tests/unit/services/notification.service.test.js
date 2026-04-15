import { describe, expect, it, vi } from "vitest";
import {
  createTeamAddedNotification,
  dismissNotificationForUser,
  listNotificationsForCurrentUser,
  markNotificationReadForUser
} from "../../../src/services/notification.service.js";

const authUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "employee"
};

describe("notification service", () => {
  it("generates due-soon notifications before listing them", async () => {
    const listDueTasks = vi.fn().mockResolvedValue([
      {
        id: "task-1",
        teamId: "team-1",
        title: "Finish report",
        dueAt: "2026-04-10T12:00:00.000Z",
        isOverdue: false
      }
    ]);
    const insertNotification = vi.fn().mockResolvedValue({});
    const loadNotifications = vi.fn().mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      total: 0
    });

    await listNotificationsForCurrentUser(
      authUser,
      {
        page: 1,
        limit: 25,
        includeDismissed: true
      },
      {
        listDueTasks,
        insertNotification,
        loadNotifications
      }
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: authUser.id,
        type: "task_due_soon",
        taskId: "task-1"
      })
    );
    expect(loadNotifications).toHaveBeenCalledWith({
      userId: authUser.id,
      includeDismissed: true,
      page: 1,
      limit: 25
    });
  });

  it("creates team-added notifications", async () => {
    const insertNotification = vi.fn().mockResolvedValue({
      id: "notification-1"
    });

    const result = await createTeamAddedNotification(
      {
        userId: authUser.id,
        teamId: "team-1",
        teamName: "Operations Team"
      },
      {
        insertNotification
      }
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "team_added",
        teamId: "team-1"
      })
    );
    expect(result.id).toBe("notification-1");
  });

  it("marks notifications as read", async () => {
    const markRead = vi.fn().mockResolvedValue({
      id: "notification-1"
    });

    const result = await markNotificationReadForUser(authUser, "notification-1", {
      markRead
    });

    expect(markRead).toHaveBeenCalledWith({
      notificationId: "notification-1",
      userId: authUser.id
    });
    expect(result.id).toBe("notification-1");
  });

  it("throws when reading a missing notification", async () => {
    const markRead = vi.fn().mockResolvedValue(null);

    await expect(
      markNotificationReadForUser(authUser, "notification-1", {
        markRead
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "NOTIFICATION_NOT_FOUND"
    });
  });

  it("dismisses notifications", async () => {
    const dismissNotification = vi.fn().mockResolvedValue({
      id: "notification-1",
      dismissedAt: "2026-04-09T12:00:00.000Z"
    });

    const result = await dismissNotificationForUser(authUser, "notification-1", {
      dismissNotification
    });

    expect(dismissNotification).toHaveBeenCalledWith({
      notificationId: "notification-1",
      userId: authUser.id
    });
    expect(result.dismissedAt).toBe("2026-04-09T12:00:00.000Z");
  });
});
