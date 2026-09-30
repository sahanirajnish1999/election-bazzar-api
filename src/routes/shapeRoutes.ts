import { Router } from "express";
import {
  createShape,
  getAllShapes,
  getShapesByCategorySlug,
  getShapeBySlug,
} from "../controllers/shapeController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createShape);
router.get("/", getAllShapes);
router.get("/category/:slug", getShapesByCategorySlug);
router.get("/:slug", getShapeBySlug);

export default router;
