import { Router } from "express";
import {
  addToWishlist,
  toggleWishlist,
  getWishlist,
  deleteWishlistItem,
  clearWishlist,
  checkWishlistStatus,
} from "../controllers/wishlistController";
import {
  authenticateUser,
  optionalAuthenticateUser,
} from "../middlewares/authMiddleware";

const router = Router();

// Get all wishlist items for authenticated user
router.get("/", authenticateUser, getWishlist);

// Add item to wishlist (requires login)
router.post("/", authenticateUser, addToWishlist);

// Toggle item in wishlist (add if not exists, remove if exists)
router.post("/toggle", authenticateUser, toggleWishlist);

// Check if category/product is in wishlist
router.get("/check/:categoryId", optionalAuthenticateUser, checkWishlistStatus);

// Clear entire wishlist for user
router.delete("/", authenticateUser, clearWishlist);

// Delete specific wishlist item by item _id, categoryId, or category slug
router.delete("/:id", authenticateUser, deleteWishlistItem);

export default router;
