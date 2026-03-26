import { z } from "zod";
import {
  GOAL_DEFAULT_LIMIT,
  GOAL_DEFAULT_PAGE,
  GOAL_MAX_LIMIT,
  GOAL_PERIOD_VALUES,
  GOAL_SCOPE_VALUES,
  GOAL_SORT_FIELD_VALUES,
  GOAL_STATUS_VALUES,
  GOAL_TYPE_VALUES,
  GOAL_SCOPES
} from "../constants/goals.js";
import { isoDateSchema } from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();
const optionalTextSchema = z.union([z.string().trim().max(5000), z.null()]).optional();
const optionalNullableUuidSchema = z.union([uuidSchema, z.null()]).optional();
const booleanLikeSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

const hasAtMostTwoDecimalPlaces = (value) => {
  const decimalPortion = value.toString().split(".")[1];
  return !decimalPortion || decimalPortion.length <= 2;
};

const goalValueSchema = z
  .number()
  .nonnegative()
  .max(1000000000)
  .refine(hasAtMostTwoDecimalPlaces, {
    message: "Goal values must have at most 2 decimal places."
  });

export const goalIdParamsSchema = z.object({
  goalId: uuidSchema
});

const goalBaseSchema = z.object({
  teamId: uuidSchema,
  targetUserId: optionalNullableUuidSchema,
  title: z.string().trim().min(1).max(200),
  description: optionalTextSchema,
  goalType: z.enum(GOAL_TYPE_VALUES).default("sales_quota"),
  scope: z.enum(GOAL_SCOPE_VALUES),
  period: z.enum(GOAL_PERIOD_VALUES).default("monthly"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  targetValue: goalValueSchema.positive(),
  actualValue: goalValueSchema.default(0),
  unit: z.string().trim().min(1).max(50).default("USD"),
  status: z.enum(GOAL_STATUS_VALUES).default("active")
});

export const createGoalBodySchema = goalBaseSchema.superRefine((value, context) => {
  if (value.startDate > value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startDate must be before or equal to endDate.",
      path: ["startDate"]
    });
  }

  if (value.scope === GOAL_SCOPES.USER && !value.targetUserId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "targetUserId is required when scope is user.",
      path: ["targetUserId"]
    });
  }

  if (value.scope === GOAL_SCOPES.TEAM && value.targetUserId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "targetUserId must be omitted when scope is team.",
      path: ["targetUserId"]
    });
  }
});

export const updateGoalBodySchema = z
  .object({
    teamId: uuidSchema.optional(),
    targetUserId: optionalNullableUuidSchema,
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalTextSchema,
    goalType: z.enum(GOAL_TYPE_VALUES).optional(),
    scope: z.enum(GOAL_SCOPE_VALUES).optional(),
    period: z.enum(GOAL_PERIOD_VALUES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    targetValue: goalValueSchema.positive().optional(),
    actualValue: goalValueSchema.optional(),
    unit: z.string().trim().min(1).max(50).optional(),
    status: z.enum(GOAL_STATUS_VALUES).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one goal field must be provided."
  });

export const listGoalsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(GOAL_DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(GOAL_MAX_LIMIT).default(GOAL_DEFAULT_LIMIT),
    teamId: uuidSchema.optional(),
    userId: uuidSchema.optional(),
    goalType: z.enum(GOAL_TYPE_VALUES).optional(),
    scope: z.enum(GOAL_SCOPE_VALUES).optional(),
    period: z.enum(GOAL_PERIOD_VALUES).optional(),
    status: z.enum(GOAL_STATUS_VALUES).optional(),
    includeCancelled: booleanLikeSchema.default(true),
    sortBy: z.enum(GOAL_SORT_FIELD_VALUES).default("endDate"),
    sortOrder: z.enum(["asc", "desc"]).default("asc")
  })
  .superRefine((value, context) => {
    if (value.scope === GOAL_SCOPES.TEAM && value.userId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "userId can only be used with user-scoped goals.",
        path: ["userId"]
      });
    }
  });
