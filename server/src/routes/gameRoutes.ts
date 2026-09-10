import { Router } from "express";
import { gameController } from "../controllers/gameController";

const router = Router();

router.get("/", gameController.list);
router.get("/:slug", gameController.getBySlug);

export default router;
