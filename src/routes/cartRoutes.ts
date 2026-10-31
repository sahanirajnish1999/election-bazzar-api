import { Router } from "express";
import {
  addToCart,
  getCart,
  updateCartItem,
  deleteCartItem,
  clearCart,
} from "../controllers/cartController";
import { optionalAuthenticateUser } from "../middlewares/authMiddleware";

const router = Router();

// Apply optional user authentication so req.user is populated if token is passed
router.use(optionalAuthenticateUser);

// GET /api/v1/cart - Retrieve cart items & totals
router.get("/", getCart);

// POST /api/v1/cart - Add item to cart
router.post("/", addToCart);

// PUT & PATCH /api/v1/cart/:itemId and /api/v1/cart/item/:itemId
router.put("/:itemId", updateCartItem);
router.patch("/:itemId", updateCartItem);
router.put("/item/:itemId", updateCartItem);
router.patch("/item/:itemId", updateCartItem);

// DELETE /api/v1/cart/:itemId and /api/v1/cart/item/:itemId
router.delete("/:itemId", deleteCartItem);
router.delete("/item/:itemId", deleteCartItem);

// DELETE /api/v1/cart - Clear entire cart
router.delete("/", clearCart);

export default router;
