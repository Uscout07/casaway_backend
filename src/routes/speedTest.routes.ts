import { Router } from "express";
import { runSpeedTest } from "../controllers/speedTestController";

const router = Router();

router.get("/speedtest", runSpeedTest);

export default router;
