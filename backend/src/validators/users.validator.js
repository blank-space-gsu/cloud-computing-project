import { z } from "zod";
import { APP_ROLES } from "../constants/roles.js";
import { isoDateSchema } from "../utils/dateValidation.js";

const uuidSchema = z.string().uuid();
const optionalNullableTrimmedTextSchema = (maxLength) =>
  z.union([z.string().trim().max(maxLength), z.null()]).optional();

const nameSchema = z.string().trim().min(1).max(100);
const optionalJobTitleSchema = optionalNullableTrimmedTextSchema(120);
const optionalAddressSchema = optionalNullableTrimmedTextSchema(500);
const optionalAvatarUrlSchema = z
  .union([z.string().trim().url().max(500), z.null()])
  .optional();
const booleanLikeSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

const pastOrTodayDateSchema = isoDateSchema.refine(
  (value) => new Date(`${value}T00:00:00.000Z`) <= new Date(),
  {
    message: "dateOfBirth cannot be in the future."
  }
);

export const updateMyProfileBodySchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    jobTitle: optionalJobTitleSchema,
    dateOfBirth: z.union([pastOrTodayDateSchema, z.null()]).optional(),
    address: optionalAddressSchema
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided."
  });

export const createEmployeeBodySchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(6).max(128),
    firstName: nameSchema,
    lastName: nameSchema,
    jobTitle: optionalJobTitleSchema,
    dateOfBirth: z.union([pastOrTodayDateSchema, z.null()]).optional(),
    address: optionalAddressSchema,
    avatarUrl: optionalAvatarUrlSchema,
    teamId: uuidSchema
  })
  .strict();

export const listUsersQuerySchema = z.object({
  role: z.enum(Object.values(APP_ROLES)).optional(),
  teamId: uuidSchema.optional(),
  includeInactive: booleanLikeSchema.default(false),
  search: z.string().trim().min(1).max(100).optional()
});

export const userIdParamsSchema = z.object({
  userId: uuidSchema
});

export const updateUserAvatarBodySchema = z
  .object({
    avatarUrl: z.union([z.string().trim().url().max(500), z.null()])
  })
  .strict();
