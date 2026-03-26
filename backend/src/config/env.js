import { z } from "zod";

const appEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_NAME: z.string().trim().min(1).default("workforce-task-management-backend"),
    API_PREFIX: z
      .string()
      .trim()
      .min(1)
      .refine((value) => value.startsWith("/"), "API_PREFIX must start with '/'.")
      .default("/api/v1"),
    FRONTEND_APP_ORIGIN: z.string().trim().default("http://localhost:5500"),
    SUPABASE_PROJECT_REF: z.string().trim().optional(),
    SUPABASE_URL: z.string().trim().url().optional(),
    SUPABASE_ANON_KEY: z.string().trim().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().trim().optional(),
    SUPABASE_JWT_SECRET: z.string().trim().optional(),
    DATABASE_URL: z.string().trim().optional(),
    DEMO_USER_PASSWORD: z.string().trim().optional(),
    DATABASE_SSL_REJECT_UNAUTHORIZED: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((value) => {
        if (typeof value === "boolean") {
          return value;
        }

        return value === "true";
      })
  })
  .transform((values) => ({
    ...values,
    frontendOrigins: values.FRONTEND_APP_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    DATABASE_SSL_REJECT_UNAUTHORIZED: values.DATABASE_SSL_REJECT_UNAUTHORIZED ?? false
  }));

export const loadEnv = (rawEnv = process.env) => {
  const parsed = appEnvSchema.safeParse(rawEnv);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Environment validation failed: ${details}`);
};

export const env = loadEnv();

export const isDatabaseConfigured = (currentEnv = env) => Boolean(currentEnv.DATABASE_URL);

export const hasSupabaseAuthConfig = (currentEnv = env) =>
  Boolean(currentEnv.SUPABASE_URL && currentEnv.SUPABASE_ANON_KEY);

export const hasSupabaseAdminConfig = (currentEnv = env) =>
  Boolean(currentEnv.SUPABASE_URL && currentEnv.SUPABASE_SERVICE_ROLE_KEY);
