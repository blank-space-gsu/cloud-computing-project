import { z } from "zod";

export const teamIdParamsSchema = z.object({
  teamId: z.string().uuid()
});

const uuidSchema = z.string().uuid();
const optionalTextSchema = z.union([z.string().trim().max(5000), z.null()]).optional();
const membershipRoleSchema = z.enum(["member", "manager"]);

export const createTeamBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: optionalTextSchema
  })
  .strict();

export const updateTeamBodySchema = createTeamBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one team field must be provided."
  }
);

export const teamMemberParamsSchema = z.object({
  teamId: uuidSchema,
  userId: uuidSchema
});

export const addTeamMemberBodySchema = z
  .object({
    userId: uuidSchema,
    membershipRole: membershipRoleSchema.default("member")
  })
  .strict();
