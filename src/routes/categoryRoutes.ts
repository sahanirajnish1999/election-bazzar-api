import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";
import { getShapesByCategorySlug } from "../controllers/shapeController";
import { getFeaturesByCategorySlug } from "../controllers/featureController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createCategory);
router.get("/", getAllCategories);
router.get("/id/:id", getCategoryById);
router.get("/shapes/:slug", getShapesByCategorySlug);
router.get("/features/:slug", getFeaturesByCategorySlug);
router.get("/:slug", getCategoryBySlug);
router.put("/:id", authenticateAdmin, updateCategory);
router.delete("/:id", authenticateAdmin, deleteCategory);

export default router;




