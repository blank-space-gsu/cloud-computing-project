import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.routes.js";
import dashboardsRouter from "./routes/dashboards.routes.js";
import goalsRouter from "./routes/goals.routes.js";
import healthRouter from "./routes/health.routes.js";
import hoursLoggedRouter from "./routes/hoursLogged.routes.js";
import productivityRouter from "./routes/productivity.routes.js";
import recurringTaskRulesRouter from "./routes/recurringTaskRules.routes.js";
import taskAssignmentsRouter from "./routes/taskAssignments.routes.js";
import teamJoinRouter from "./routes/teamJoin.routes.js";
import tasksRouter from "./routes/tasks.routes.js";
import teamsRouter from "./routes/teams.routes.js";
import usersRouter from "./routes/users.routes.js";
import workerTrackerRouter from "./routes/workerTracker.routes.js";

const app = express();
const configuredOrigins = env.frontendOrigins.length > 0 ? env.frontendOrigins : true;

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin: configuredOrigins,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(`${env.API_PREFIX}/health`, healthRouter);
app.use(`${env.API_PREFIX}/auth`, authRouter);
app.use(`${env.API_PREFIX}/users`, usersRouter);
app.use(`${env.API_PREFIX}/teams`, teamsRouter);
app.use(`${env.API_PREFIX}/team-join`, teamJoinRouter);
app.use(`${env.API_PREFIX}/tasks`, tasksRouter);
app.use(`${env.API_PREFIX}/task-assignments`, taskAssignmentsRouter);
app.use(`${env.API_PREFIX}/recurring-task-rules`, recurringTaskRulesRouter);
app.use(`${env.API_PREFIX}/worker-tracker`, workerTrackerRouter);
app.use(`${env.API_PREFIX}/dashboards`, dashboardsRouter);
app.use(`${env.API_PREFIX}/hours-logged`, hoursLoggedRouter);
app.use(`${env.API_PREFIX}/productivity-metrics`, productivityRouter);
app.use(`${env.API_PREFIX}/goals`, goalsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
