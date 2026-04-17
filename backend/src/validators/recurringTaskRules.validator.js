import { z } from "zod";
import {
  RECURRING_TASK_FREQUENCY_VALUES
} from "../constants/recurringTasks.js";
import {
  TASK_PRIORITY_VALUES
} from "../constants/tasks.js";
import { isoDateSchema } from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();
const optionalTextSchema = z.union([z.string().trim().max(5000), z.null()]).optional();
const dueTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "dueTime must use HH:MM 24-hour format.");

const normalizeWeekdays = (value) => {
  if (!value) {
    return undefined;
  }

  return [...new Set(value.map(Number))].sort((left, right) => left - right);
};

export const createRecurringTaskRuleBodySchema = z.object({
  teamId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  description: optionalTextSchema,
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  defaultAssigneeUserId: z.union([uuidSchema, z.null()]).optional(),
  frequency: z.enum(RECURRING_TASK_FREQUENCY_VALUES),
  weekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .optional()
    .transform(normalizeWeekdays),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  dueTime: dueTimeSchema,
  startsOn: isoDateSchema,
  endsOn: z.union([isoDateSchema, z.null()]).optional()
}).superRefine((value, context) => {
  if (
    value.endsOn
    && Date.parse(`${value.startsOn}T00:00:00.000Z`) >
      Date.parse(`${value.endsOn}T00:00:00.000Z`)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endsOn must be after or equal to startsOn.",
      path: ["endsOn"]
    });
  }

  if (value.frequency === "weekly") {
    if (!value.weekdays?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekdays are required for weekly recurring tasks.",
        path: ["weekdays"]
      });
    }

    if (value.dayOfMonth !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayOfMonth is only allowed for monthly recurring tasks.",
        path: ["dayOfMonth"]
      });
    }
  }

  if (value.frequency === "monthly") {
    if (value.dayOfMonth === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayOfMonth is required for monthly recurring tasks.",
        path: ["dayOfMonth"]
      });
    }

    if (value.weekdays?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekdays are only allowed for weekly recurring tasks.",
        path: ["weekdays"]
      });
    }
  }

  if (value.frequency === "daily") {
    if (value.weekdays?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekdays are only allowed for weekly recurring tasks.",
        path: ["weekdays"]
      });
    }

    if (value.dayOfMonth !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayOfMonth is only allowed for monthly recurring tasks.",
        path: ["dayOfMonth"]
      });
    }
  }
});
