import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discordRouter from "./discord";
import authRouter from "./auth";
import botsRouter from "./bots";

const router: IRouter = Router();

// Routes are mounted at the paths defined in the OpenAPI spec (servers: /api).
// discordRouter already declares "/discord/status", "/guilds", etc., so it is
// mounted without an extra prefix to match the generated client exactly.
router.use(healthRouter);
router.use(discordRouter);
router.use("/auth", authRouter);
router.use("/discord", botsRouter);

export default router;
