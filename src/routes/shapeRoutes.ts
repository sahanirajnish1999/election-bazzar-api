import { Router } from "express";
import {
  createShape,
  getAllShapes,
  getShapesByCategoryId,
  getShapeBySlug,
} from "../controllers/shapeController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createShape);
router.get("/", getAllShapes);
router.get("/category/:categoryId", getShapesByCategoryId);
router.get("/:slug", getShapeBySlug);

export default router;
