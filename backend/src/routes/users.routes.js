import { Router } from "express";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import authenticate from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import {
  createEmployee,
  getMyProfile,
  listUsers,
  updateMyProfile,
  updateUserAvatar
} from "../controllers/users.controller.js";

const usersRouter = Router();

usersRouter.get("/me", authenticate, getMyProfile);
usersRouter.patch("/me", authenticate, updateMyProfile);
usersRouter.get(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  listUsers
);
usersRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createEmployee
);
usersRouter.patch(
  "/:userId/avatar",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  updateUserAvatar
);

export default usersRouter;
