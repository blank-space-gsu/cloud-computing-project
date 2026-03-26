import { Router } from "express";
import { APP_ROLES } from "../constants/roles.js";
import {
  getEmployeeDashboard,
  getManagerDashboard
} from "../controllers/dashboards.controller.js";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const dashboardsRouter = Router();

dashboardsRouter.get(
  "/employee",
  authenticate,
  authorizeRoles(APP_ROLES.EMPLOYEE),
  getEmployeeDashboard
);

dashboardsRouter.get(
  "/manager",
  authenticate,
  authorizeRoles(APP_ROLES.MANAGER, APP_ROLES.ADMIN),
  getManagerDashboard
);

export default dashboardsRouter;
