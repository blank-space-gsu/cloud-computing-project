import { z } from "zod";
import { APP_ROLES } from "../constants/roles.js";

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128)
});

export const signupRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  jobTitle: z.union([z.string().trim().max(120), z.null()]).optional(),
  appRole: z.enum([APP_ROLES.MANAGER, APP_ROLES.EMPLOYEE])
});
