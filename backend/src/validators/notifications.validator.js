import { z } from "zod";
import {
  NOTIFICATION_DEFAULT_LIMIT,
  NOTIFICATION_DEFAULT_PAGE,
  NOTIFICATION_MAX_LIMIT
} from "../constants/notifications.js";

const uuidSchema = z.string().uuid();
const booleanLikeSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const notificationIdParamsSchema = z.object({
  notificationId: uuidSchema
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(NOTIFICATION_DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(NOTIFICATION_MAX_LIMIT).default(
    NOTIFICATION_DEFAULT_LIMIT
  ),
  includeDismissed: booleanLikeSchema.default(true)
});
