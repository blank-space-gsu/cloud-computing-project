import { sendSuccess } from "../utils/apiResponse.js";
import { env } from "../config/env.js";
import { checkDatabaseHealth } from "../db/health.js";

export const getHealth = async (request, response) => {
  const database = await checkDatabaseHealth();

  return sendSuccess(response, {
    message: "Backend service is healthy.",
    data: {
      status: "ok",
      service: env.APP_NAME,
      environment: env.NODE_ENV,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      version: process.env.npm_package_version ?? "0.1.0",
      database
    },
    meta: {
      path: request.originalUrl,
      method: request.method
    }
  });
};
