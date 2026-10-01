import { Router } from "express";
import { getDetailsByCategorySlug } from "../controllers/detailController";

const router = Router();

router.get("/category/:slug", getDetailsByCategorySlug);
router.get("/:slug", getDetailsByCategorySlug);

export default router;
