import { Router } from "express";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  createGoalHandler,
  listGoalsHandler,
  updateGoalHandler
} from "../controllers/goals.controller.js";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

const goalsRouter = Router();

goalsRouter.get("/", authenticate, listGoalsHandler);
goalsRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createGoalHandler
);
goalsRouter.patch(
  "/:goalId",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  updateGoalHandler
);

export default goalsRouter;
