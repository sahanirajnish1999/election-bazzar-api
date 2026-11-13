import { Router } from "express";
import { getAllProducts, getProductBySlug, searchProducts } from "../controllers/productController";

const router = Router();

// GET /api/v1/products - Returns array of all products with shapes & options
router.get("/", getAllProducts);

// GET /api/v1/products/search - Returns search results for search bar
router.get("/search", searchProducts);

// GET /api/v1/products/:slug - Returns product data for a slug or ID
router.get("/:slug", getProductBySlug);

export default router;
