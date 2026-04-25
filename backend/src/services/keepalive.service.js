import { env, isDatabaseConfigured } from "../config/env.js";
import { getPool } from "../db/pool.js";
import { createAppError } from "../utils/appError.js";

export const runKeepaliveCheck = async ({
  currentEnv = env,
  poolFactory = getPool
} = {}) => {
  if (!isDatabaseConfigured(currentEnv)) {
    throw createAppError({
      statusCode: 503,
      code: "DATABASE_NOT_CONFIGURED",
      message: "Keepalive database check is not configured."
    });
  }

  try {
    const pool = poolFactory(currentEnv);
    const result = await pool.query(
      "select 1 as keepalive, now() at time zone 'utc' as checked_at"
    );
    const row = result.rows[0];

    return {
      status: "ok",
      api: "alive",
      database: {
        status: "connected",
        check: "select_1",
        checkedAt: new Date(row.checked_at).toISOString()
      }
    };
  } catch {
    throw createAppError({
      statusCode: 503,
      code: "DATABASE_UNREACHABLE",
      message: "Keepalive database check failed."
    });
  }
};
