import { Router } from "express";
import { userController } from "../controllers/userController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/me/history", requireAuth, userController.getMyHistory);

export default router;
