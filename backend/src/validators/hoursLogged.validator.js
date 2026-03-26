import { z } from "zod";
import {
  HOURS_DEFAULT_LIMIT,
  HOURS_DEFAULT_PAGE,
  HOURS_MAX_LIMIT,
  HOURS_SORT_FIELD_VALUES
} from "../constants/hours.js";
import { isoDateSchema } from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();
const optionalTextSchema = z.union([z.string().trim().max(2000), z.null()]).optional();

const hasAtMostTwoDecimalPlaces = (value) => {
  const decimalPortion = value.toString().split(".")[1];
  return !decimalPortion || decimalPortion.length <= 2;
};

const hoursAmountSchema = z
  .number()
  .positive()
  .max(24)
  .refine(hasAtMostTwoDecimalPlaces, {
    message: "Hours must have at most 2 decimal places."
  });

export const createHoursLogBodySchema = z.object({
  teamId: uuidSchema,
  taskId: uuidSchema.nullable().optional(),
  workDate: isoDateSchema,
  hours: hoursAmountSchema,
  note: optionalTextSchema
});

export const listHoursLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(HOURS_DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(HOURS_MAX_LIMIT).default(
      HOURS_DEFAULT_LIMIT
    ),
    teamId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    userId: uuidSchema.optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    sortBy: z.enum(HOURS_SORT_FIELD_VALUES).default("workDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc")
  })
  .refine(
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

export const hoursLogIdParamsSchema = z.object({
  hoursLogId: uuidSchema
});
