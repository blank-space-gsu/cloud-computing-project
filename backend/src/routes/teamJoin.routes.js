import { Router } from "express";
import { APP_ROLES } from "../constants/roles.js";
import { joinTeamHandler } from "../controllers/teamJoin.controller.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import authenticate from "../middleware/authenticate.js";

const teamJoinRouter = Router();

teamJoinRouter.post(
  "/",
  authenticate,
  authorizeRoles(APP_ROLES.EMPLOYEE),
  joinTeamHandler
);

export default teamJoinRouter;
