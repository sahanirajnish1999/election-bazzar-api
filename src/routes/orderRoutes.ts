import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orderController";
import {
  authenticateUser,
  optionalAuthenticateUser,
} from "../middlewares/authMiddleware";

const router = Router();

// Apply optionalAuthenticateUser so authenticated users have req.user populated
router.use(optionalAuthenticateUser);

// GET /api/v1/orders - Retrieve orders for user or admin
router.get("/", getOrders);

// POST /api/v1/orders - Create a new order (requires authenticated user)
router.post("/", authenticateUser, createOrder);

// GET /api/v1/orders/:id - Retrieve order details by ID or orderId
router.get("/:id", getOrderById);

// PATCH & PUT /api/v1/orders/:id - Update order status or payment status
router.patch("/:id", updateOrderStatus);
router.put("/:id", updateOrderStatus);

// DELETE /api/v1/orders/:id - Delete order
router.delete("/:id", deleteOrder);

export default router;
