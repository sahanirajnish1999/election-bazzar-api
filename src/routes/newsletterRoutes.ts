import { Router } from "express";
import { subscribeNewsletter } from "../controllers/newsletterController";

const router = Router();

// POST /api/v1/newsletter - Subscribe email to newsletter
router.post("/", subscribeNewsletter);

export default router;
