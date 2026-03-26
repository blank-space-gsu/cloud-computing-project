import { z } from "zod";

export const managerDashboardQuerySchema = z.object({
  teamId: z.string().uuid().optional()
});
