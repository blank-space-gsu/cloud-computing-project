import { Router } from "express";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import authenticate from "../middleware/authenticate.js";
import { PRIVILEGED_ROLES } from "../constants/roles.js";
import {
  createTaskHandler,
  deleteTaskHandler,
  getTaskById,
  listTasks,
  updateTaskHandler
} from "../controllers/tasks.controller.js";

const tasksRouter = Router();

tasksRouter.get("/", authenticate, listTasks);
tasksRouter.post(
  "/",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  createTaskHandler
);
tasksRouter.get("/:taskId", authenticate, getTaskById);
tasksRouter.patch("/:taskId", authenticate, updateTaskHandler);
tasksRouter.delete(
  "/:taskId",
  authenticate,
  authorizeRoles(...PRIVILEGED_ROLES),
  deleteTaskHandler
);

export default tasksRouter;
