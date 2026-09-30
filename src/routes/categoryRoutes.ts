import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryBySlug,
} from "../controllers/categoryController";
import { getShapesByCategoryId } from "../controllers/shapeController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createCategory);
router.get("/", getAllCategories);
router.get("/:slug", getCategoryBySlug);
router.get("/:categoryId/shapes", getShapesByCategoryId);

export default router;
