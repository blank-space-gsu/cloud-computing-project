import { Router } from "express";
import { getProductivityMetrics } from "../controllers/productivity.controller.js";
import authenticate from "../middleware/authenticate.js";

const productivityRouter = Router();

productivityRouter.get("/", authenticate, getProductivityMetrics);

export default productivityRouter;
