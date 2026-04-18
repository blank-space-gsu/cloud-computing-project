import { z } from "zod";

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

const isLoopbackUrl = (value) => {
  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(value).hostname);
  } catch {
    return false;
  }
};

const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const expandLoopbackOrigins = (origins) => {
  const expandedOrigins = new Set(origins);

  origins.forEach((origin) => {
    try {
      const parsedOrigin = new URL(origin);

      if (!LOOPBACK_HOSTNAMES.includes(parsedOrigin.hostname)) {
        return;
      }

      LOOPBACK_HOSTNAMES.forEach((hostname) => {
        const aliasOrigin = new URL(origin);
        aliasOrigin.hostname = hostname;
        expandedOrigins.add(aliasOrigin.origin);
      });
    } catch {
      expandedOrigins.add(origin);
    }
  });

  return Array.from(expandedOrigins);
};

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
    SUPABASE_AUTH_EMAIL_REDIRECT_TO: z.string().trim().url().optional(),
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
    frontendOrigins: expandLoopbackOrigins(
      values.FRONTEND_APP_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
    authEmailRedirectTo:
      values.SUPABASE_AUTH_EMAIL_REDIRECT_TO
      ?? values.FRONTEND_APP_ORIGIN.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .find(Boolean)
      ?? "http://localhost:5500",
    DATABASE_SSL_REJECT_UNAUTHORIZED: values.DATABASE_SSL_REJECT_UNAUTHORIZED ?? false
  }));

export const loadEnv = (rawEnv = process.env) => {
  const parsed = appEnvSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new Error(`Environment validation failed: ${details}`);
  }

  const values = parsed.data;
  const issues = [];

  if (values.NODE_ENV === "production") {
    const explicitRedirect = rawEnv.SUPABASE_AUTH_EMAIL_REDIRECT_TO?.trim();

    if (!explicitRedirect) {
      issues.push(
        "SUPABASE_AUTH_EMAIL_REDIRECT_TO must be set explicitly in production."
      );
    }

    values.frontendOrigins.forEach((origin) => {
      if (isLoopbackUrl(origin)) {
        issues.push(
          `FRONTEND_APP_ORIGIN cannot include loopback origins in production (${origin}).`
        );
      }

      if (!isHttpsUrl(origin)) {
        issues.push(
          `FRONTEND_APP_ORIGIN must use https in production (${origin}).`
        );
      }
    });

    if (isLoopbackUrl(values.authEmailRedirectTo)) {
      issues.push(
        `SUPABASE_AUTH_EMAIL_REDIRECT_TO cannot point to a loopback URL in production (${values.authEmailRedirectTo}).`
      );
    }

    if (!isHttpsUrl(values.authEmailRedirectTo)) {
      issues.push(
        `SUPABASE_AUTH_EMAIL_REDIRECT_TO must use https in production (${values.authEmailRedirectTo}).`
      );
    }

    try {
      const redirectOrigin = new URL(values.authEmailRedirectTo).origin;
      if (!values.frontendOrigins.includes(redirectOrigin)) {
        issues.push(
          "SUPABASE_AUTH_EMAIL_REDIRECT_TO must share an origin with FRONTEND_APP_ORIGIN in production."
        );
      }
    } catch {
      issues.push("SUPABASE_AUTH_EMAIL_REDIRECT_TO must be a valid URL.");
    }
  }

  if (issues.length > 0) {
    throw new Error(`Environment validation failed: ${issues.join("; ")}`);
  }

  return values;
};

export const env = loadEnv();

export const isDatabaseConfigured = (currentEnv = env) => Boolean(currentEnv.DATABASE_URL);

export const hasSupabaseAuthConfig = (currentEnv = env) =>
  Boolean(currentEnv.SUPABASE_URL && currentEnv.SUPABASE_ANON_KEY);

export const hasSupabaseAdminConfig = (currentEnv = env) =>
  Boolean(currentEnv.SUPABASE_URL && currentEnv.SUPABASE_SERVICE_ROLE_KEY);
