import app from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./db/pool.js";

const port = env.PORT;

const server = app.listen(port, () => {
  console.log(`Backend API listening on port ${port}`);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down backend API.`);

  server.close(async () => {
    try {
      await closePool();
      process.exit(0);
    } catch (error) {
      console.error("Failed to close database pool during shutdown.", error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
