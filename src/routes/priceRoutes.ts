import { Router } from "express";
import {
  createOrUpdatePrice,
  updatePrice,
  decidePriceFromShape,
  getPriceByShapeId,
  getAllPrices,
  getPricingShapesByProductId,
} from "../controllers/priceController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createOrUpdatePrice);
router.put("/:id", authenticateAdmin, updatePrice);

router.post("/decide", decidePriceFromShape);
router.get("/decide/:shapeId", decidePriceFromShape);

// GET /api/v1/pricing/shapes/:productId or /api/v1/prices/shapes/:productId
router.get("/shapes/:productId", getPricingShapesByProductId);

router.get("/shape/:shapeId", getPriceByShapeId);

router.get("/", getAllPrices);

export default router;

