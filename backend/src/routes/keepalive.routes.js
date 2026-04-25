import { Router } from "express";
import { getKeepalive } from "../controllers/keepalive.controller.js";

const keepaliveRouter = Router();

keepaliveRouter.get("/", getKeepalive);

export default keepaliveRouter;
