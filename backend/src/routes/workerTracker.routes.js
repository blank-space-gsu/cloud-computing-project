import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import { getWorkerTracker } from "../controllers/workerTracker.controller.js";

const workerTrackerRouter = Router();

workerTrackerRouter.get(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  getWorkerTracker
);

export default workerTrackerRouter;
