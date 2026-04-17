import { Router } from "express";
import { getCurrentUser, login, signup } from "../controllers/auth.controller.js";
import { getManagerAccessCheck } from "../controllers/rbac.controller.js";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { APP_ROLES } from "../constants/roles.js";

const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.get("/me", authenticate, getCurrentUser);
authRouter.get(
  "/manager-access",
  authenticate,
  authorizeRoles(APP_ROLES.MANAGER, APP_ROLES.ADMIN),
  getManagerAccessCheck
);

export default authRouter;
