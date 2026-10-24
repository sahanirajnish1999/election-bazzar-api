import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
} from "../controllers/cartController";

const router = Router();

// GET /api/v1/cart - Retrieve cart items & totals
router.get("/", getCart);

// POST /api/v1/cart - Add item to cart
router.post("/", addToCart);

// PUT /api/v1/cart/item/:itemId - Update item quantity / details
router.put("/item/:itemId", updateCartItem);

// DELETE /api/v1/cart/item/:itemId - Remove item from cart
router.delete("/item/:itemId", deleteCartItem);

// DELETE /api/v1/cart - Clear entire cart
router.delete("/", clearCart);

export default router;
