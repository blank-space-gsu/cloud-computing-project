import { z } from "zod";

const joinCodeSchema = z.string().trim().min(4).max(64).transform((value) => value.toUpperCase());

const normalizeInviteToken = (value) => {
  const trimmedValue = value.trim();

  try {
    const parsed = new URL(trimmedValue);
    return parsed.searchParams.get("inviteToken")?.trim() || trimmedValue;
  } catch {
    return trimmedValue;
  }
};

const inviteTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .transform(normalizeInviteToken)
  .refine((value) => value.length > 0, "Invite token is required.");

export const teamJoinBodySchema = z
  .object({
    joinCode: joinCodeSchema.optional(),
    inviteToken: inviteTokenSchema.optional()
  })
  .strict()
  .refine(
    (value) => (value.joinCode ? 1 : 0) + (value.inviteToken ? 1 : 0) === 1,
    {
      message: "Provide exactly one of joinCode or inviteToken."
    }
  );
