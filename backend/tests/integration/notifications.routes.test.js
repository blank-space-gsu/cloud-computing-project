import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resolveAuthenticatedUser,
  listNotificationsForCurrentUser,
  markNotificationReadForUser,
  dismissNotificationForUser
} = vi.hoisted(() => ({
  resolveAuthenticatedUser: vi.fn(),
  listNotificationsForCurrentUser: vi.fn(),
  markNotificationReadForUser: vi.fn(),
  dismissNotificationForUser: vi.fn()
}));

vi.mock("../../src/services/auth.service.js", () => ({
  loginUser: vi.fn(),
  resolveAuthenticatedUser
}));

vi.mock("../../src/services/notification.service.js", () => ({
  listNotificationsForCurrentUser,
  markNotificationReadForUser,
  dismissNotificationForUser,
  createTeamAddedNotification: vi.fn()
}));

const { default: app } = await import("../../src/app.js");

describe("notifications routes", () => {
  const notificationId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthenticatedUser.mockResolvedValue({
      user: {
        id: "11111111-1111-1111-1111-111111111111",
        email: "employee.one@cloudcomputing.local",
        fullName: "Ethan Employee",
        appRole: "employee",
        teams: []
      },
      accessToken: "access-token"
    });
  });

  it("requires authentication for the notifications list", async () => {
    const response = await request(app).get("/api/v1/notifications");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("lists notifications for the current user", async () => {
    listNotificationsForCurrentUser.mockResolvedValue({
      notifications: [
        {
          id: notificationId,
          type: "team_added",
          title: "Added to team",
          message: "You were added to a new team.",
          readAt: null,
          dismissedAt: null
        }
      ],
      unreadCount: 1,
      total: 1
    });

    const response = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.notifications).toHaveLength(1);
    expect(response.body.data.unreadCount).toBe(1);
  });

  it("marks a notification as read", async () => {
    markNotificationReadForUser.mockResolvedValue({
      id: notificationId,
      readAt: "2026-04-09T12:00:00.000Z"
    });

    const response = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.notification.readAt).toBe("2026-04-09T12:00:00.000Z");
  });

  it("dismisses a notification", async () => {
    dismissNotificationForUser.mockResolvedValue({
      id: notificationId,
      dismissedAt: "2026-04-09T12:00:00.000Z"
    });

    const response = await request(app)
      .delete(`/api/v1/notifications/${notificationId}`)
      .set("Authorization", "Bearer access-token");

    expect(response.status).toBe(200);
    expect(response.body.data.notification.dismissedAt).toBe("2026-04-09T12:00:00.000Z");
  });
});
