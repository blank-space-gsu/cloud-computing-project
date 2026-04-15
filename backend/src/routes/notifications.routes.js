import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import {
  dismissNotificationHandler,
  listNotificationsHandler,
  markNotificationReadHandler
} from "../controllers/notifications.controller.js";

const notificationsRouter = Router();

notificationsRouter.get("/", authenticate, listNotificationsHandler);
notificationsRouter.patch("/:notificationId/read", authenticate, markNotificationReadHandler);
notificationsRouter.delete("/:notificationId", authenticate, dismissNotificationHandler);

export default notificationsRouter;
