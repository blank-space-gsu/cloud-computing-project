import { z } from "zod";
import {
  TASK_DEFAULT_LIMIT,
  TASK_DEFAULT_PAGE,
  TASK_MAX_LIMIT,
  TASK_PRIORITY_VALUES,
  TASK_SORT_FIELD_VALUES,
  TASK_STATUS_VALUES
} from "../constants/tasks.js";
import {
  isoDateSchema,
  mondayDateSchema
} from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const optionalTextSchema = z.union([z.string().trim().max(5000), z.null()]).optional();
const optionalHoursSchema = z.number().min(0).max(9999.99).nullable().optional();
const optionalProgressSchema = z.number().int().min(0).max(100).optional();
const booleanLikeSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const taskIdParamsSchema = z.object({
  taskId: uuidSchema
});

export const createTaskBodySchema = z.object({
  teamId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  description: optionalTextSchema,
  notes: optionalTextSchema,
  status: z.enum(TASK_STATUS_VALUES).optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  dueAt: z.union([isoDateTimeSchema, z.null()]).optional(),
  weekStartDate: mondayDateSchema,
  estimatedHours: optionalHoursSchema,
  progressPercent: optionalProgressSchema
});

export const updateTaskBodySchema = createTaskBodySchema
  .omit({
    teamId: true
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one task field must be provided."
  });

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(TASK_DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(TASK_MAX_LIMIT).default(TASK_DEFAULT_LIMIT),
  teamId: uuidSchema.optional(),
  assigneeUserId: uuidSchema.optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  weekStartDate: mondayDateSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  includeCompleted: booleanLikeSchema.default(true),
  sortBy: z.enum(TASK_SORT_FIELD_VALUES).default("urgency"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
}).refine(
  (value) =>
    !value.dateFrom ||
    !value.dateTo ||
    Date.parse(`${value.dateFrom}T00:00:00.000Z`) <=
      Date.parse(`${value.dateTo}T00:00:00.000Z`),
  {
    message: "dateFrom must be before or equal to dateTo.",
    path: ["dateFrom"]
  }
);

export const createTaskAssignmentBodySchema = z.object({
  taskId: uuidSchema,
  assigneeUserId: uuidSchema,
  assignmentNote: optionalTextSchema
});
