import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import {
  getTeamById,
  listMyTeams,
  listTeamMembers
} from "../controllers/teams.controller.js";

const teamsRouter = Router();

teamsRouter.get("/", authenticate, listMyTeams);
teamsRouter.get("/:teamId", authenticate, getTeamById);
teamsRouter.get("/:teamId/members", authenticate, listTeamMembers);

export default teamsRouter;
