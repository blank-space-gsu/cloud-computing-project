import { Router } from "express";
import authenticate from "../middleware/authenticate.js";
import {
  createHoursLoggedHandler,
  listHoursLogged
} from "../controllers/hoursLogged.controller.js";

const hoursLoggedRouter = Router();

hoursLoggedRouter.get("/", authenticate, listHoursLogged);
hoursLoggedRouter.post("/", authenticate, createHoursLoggedHandler);

export default hoursLoggedRouter;
