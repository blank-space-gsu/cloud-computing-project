import { Router } from "express";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import { createTaskAssignmentHandler } from "../controllers/taskAssignments.controller.js";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const taskAssignmentsRouter = Router();

taskAssignmentsRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createTaskAssignmentHandler
);

export default taskAssignmentsRouter;
