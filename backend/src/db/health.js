import { env, isDatabaseConfigured } from "../config/env.js";
import { getPool } from "./pool.js";

export const checkDatabaseHealth = async ({
  currentEnv = env,
  poolFactory = getPool
} = {}) => {
  if (!isDatabaseConfigured(currentEnv)) {
    return {
      status: "not_configured"
    };
  }

  try {
    const pool = poolFactory(currentEnv);
    const result = await pool.query(
      "select current_database() as database_name, now() at time zone 'utc' as checked_at"
    );
    const row = result.rows[0];

    return {
      status: "connected",
      databaseName: row.database_name,
      checkedAt: new Date(row.checked_at).toISOString()
    };
  } catch (error) {
    return {
      status: "unreachable",
      message: error.message
    };
  }
};
