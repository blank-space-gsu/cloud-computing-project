import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import { getMyProfile } from "../controllers/users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticate, getMyProfile);

export default usersRouter;
