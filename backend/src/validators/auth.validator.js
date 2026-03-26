import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128)
});
