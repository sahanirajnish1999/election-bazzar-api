import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryBySlug,
} from "../controllers/categoryController";
import { getShapesByCategorySlug } from "../controllers/shapeController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createCategory);
router.get("/", getAllCategories);
router.get("/shapes/:slug", getShapesByCategorySlug);
router.get("/:slug", getCategoryBySlug);

export default router;
