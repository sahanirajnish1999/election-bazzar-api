import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orderController";

const router = Router();

// GET /api/v1/orders - Retrieve orders
router.get("/", getOrders);

// POST /api/v1/orders - Create a new order
router.post("/", createOrder);

// GET /api/v1/orders/:id - Retrieve order details by ID or orderId
router.get("/:id", getOrderById);

// PATCH /api/v1/orders/:id - Update order status or payment status
router.patch("/:id", updateOrderStatus);

// PUT /api/v1/orders/:id - Update order status or payment status
router.put("/:id", updateOrderStatus);

// DELETE /api/v1/orders/:id - Delete order
router.delete("/:id", deleteOrder);

export default router;
