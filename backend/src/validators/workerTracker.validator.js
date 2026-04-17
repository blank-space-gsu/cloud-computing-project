import { z } from "zod";

export const workerTrackerQuerySchema = z.object({
  teamId: z.string().uuid().optional(),
  memberUserId: z.string().uuid().optional()
});
