import { Router } from "express";
import { joinTeamHandler } from "../controllers/teamJoin.controller.js";
import authenticate from "../middleware/authenticate.js";

const teamJoinRouter = Router();

teamJoinRouter.post("/", authenticate, joinTeamHandler);

export default teamJoinRouter;
