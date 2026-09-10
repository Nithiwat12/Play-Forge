import { Router } from "express";
import { userController } from "../controllers/userController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/me/history", requireAuth, userController.getMyHistory);
router.get("/me/active-rooms", requireAuth, userController.getMyActiveRooms);
router.get("/me/left-rooms", requireAuth, userController.getMyLeftRooms);

export default router;
