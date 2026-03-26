import { z } from "zod";
import {
  PRODUCTIVITY_SCOPES,
  PRODUCTIVITY_SCOPE_VALUES
} from "../constants/productivity.js";
import { isoDateSchema } from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();

export const productivityMetricsQuerySchema = z
  .object({
    scope: z.enum(PRODUCTIVITY_SCOPE_VALUES).optional(),
    teamId: uuidSchema.optional(),
    userId: uuidSchema.optional(),
    referenceDate: isoDateSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.scope === PRODUCTIVITY_SCOPES.TEAM && value.userId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "userId can only be used with individual productivity scope.",
        path: ["userId"]
      });
    }
  });
