import { Router } from "express";
import { roomController } from "../controllers/roomController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/", requireAuth, roomController.create);
router.post("/join", requireAuth, roomController.join);
router.get("/:roomCode", requireAuth, roomController.getByCode);
router.post("/:roomCode/leave", requireAuth, roomController.leave);
router.get("/:roomCode/scoreboard", requireAuth, roomController.getScoreboard);

export default router;
