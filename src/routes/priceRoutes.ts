import { Router } from "express";
import {
  createOrUpdatePrice,
  updatePrice,
  decidePriceFromShape,
  getPriceByShapeId,
  getAllPrices,
} from "../controllers/priceController";
import { authenticateAdmin } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", authenticateAdmin, createOrUpdatePrice);
router.put("/:id", authenticateAdmin, updatePrice);

router.post("/decide", decidePriceFromShape);
router.get("/decide/:shapeId", decidePriceFromShape);

router.get("/shape/:shapeId", getPriceByShapeId);

router.get("/", getAllPrices);

export default router;
