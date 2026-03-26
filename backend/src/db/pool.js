import pg from "pg";
import { env, isDatabaseConfigured } from "../config/env.js";

const { Pool } = pg;

let pool;

const normalizeConnectionString = (connectionString, rejectUnauthorized) => {
  if (!connectionString) {
    return connectionString;
  }

  if (rejectUnauthorized) {
    return connectionString;
  }

  return connectionString
    .replace("sslmode=require", "sslmode=no-verify")
    .replace("?sslmode=verify-full", "?sslmode=no-verify")
    .replace("&sslmode=verify-full", "&sslmode=no-verify");
};

export const createPool = (currentEnv = env) =>
  new Pool({
    connectionString: normalizeConnectionString(
      currentEnv.DATABASE_URL,
      currentEnv.DATABASE_SSL_REJECT_UNAUTHORIZED
    ),
    ssl: {
      rejectUnauthorized: currentEnv.DATABASE_SSL_REJECT_UNAUTHORIZED
    }
  });

export const getPool = (currentEnv = env) => {
  if (!isDatabaseConfigured(currentEnv)) {
    throw new Error("DATABASE_URL is required before using database features.");
  }

  if (!pool) {
    pool = createPool(currentEnv);
  }

  return pool;
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
