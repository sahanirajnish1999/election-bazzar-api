import { Router } from "express";
import {
  createOrUpdateFeature,
  updateFeature,
  getAllFeatures,
  getFeatureById,
  getFeatureByShapeId,
  getFeaturesByCategorySlug,
} from "../controllers/featureController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createOrUpdateFeature);
router.put("/:id", authenticateAdmin, updateFeature);
router.get("/", getAllFeatures);
router.get("/shape/:shapeId", getFeatureByShapeId);
router.get("/category/:slug", getFeaturesByCategorySlug);
router.get("/:id", getFeatureById);

export default router;
