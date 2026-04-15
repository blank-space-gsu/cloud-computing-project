import { Router } from "express";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import authenticate from "../middleware/authenticate.js";
import {
  addTeamMemberHandler,
  createTeamHandler,
  getTeamById,
  listMyTeams,
  listTeamMembers,
  removeTeamMemberHandler,
  updateTeamHandler
} from "../controllers/teams.controller.js";

const teamsRouter = Router();

teamsRouter.get("/", authenticate, listMyTeams);
teamsRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createTeamHandler
);
teamsRouter.get("/:teamId", authenticate, getTeamById);
teamsRouter.patch(
  "/:teamId",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  updateTeamHandler
);
teamsRouter.get("/:teamId/members", authenticate, listTeamMembers);
teamsRouter.post(
  "/:teamId/members",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  addTeamMemberHandler
);
teamsRouter.delete(
  "/:teamId/members/:userId",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  removeTeamMemberHandler
);

export default teamsRouter;
