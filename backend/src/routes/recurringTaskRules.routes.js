import { Router } from "express";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import authenticate from "../middleware/authenticate.js";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import { createRecurringTaskRuleHandler } from "../controllers/recurringTaskRules.controller.js";

const recurringTaskRulesRouter = Router();

recurringTaskRulesRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createRecurringTaskRuleHandler
);

export default recurringTaskRulesRouter;
