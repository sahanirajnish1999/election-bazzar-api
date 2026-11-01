import { Router } from "express";
import { compareCategories } from "../controllers/compareController";

const router = Router();

// GET /api/v1/compare?category1=...&category2=...
router.get("/", compareCategories);

// POST /api/v1/compare (body: { category1, category2 })
router.post("/", compareCategories);

export default router;
