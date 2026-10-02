import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order, IOrderItem } from "../models/Order.Schema";
import { Cart } from "../models/Cart.Schema";

// Generate unique order ID helper
const generateOrderId = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${randomNum}`;
};

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      items: inputItems,
      shippingAddress: inputShippingAddress,
      address,
      name,
      fullName,
      email,
      phone,
      city,
      state,
      pincode,
      zipCode,
      country,
      paymentDetails: inputPaymentDetails,
      paymentMethod,
      paymentStatus,
      transactionId,
      subtotal: inputSubtotal,
      tax: inputTax,
      shippingFee: inputShippingFee,
      totalAmount: inputTotalAmount,
      totalPrice: inputTotalPrice,
      userId,
      sessionId,
      clearCartAfterOrder = true,
    } = req.body;

    const queryUserId = userId || req.body.user?._id;
    const querySessionId = sessionId || (req.headers["x-session-id"] as string);

    let orderItems: IOrderItem[] = [];
    let cartToClear: any = null;

    // If explicit items array passed in body, use that
    if (Array.isArray(inputItems) && inputItems.length > 0) {
      orderItems = inputItems.map((item: any) => ({
        _id: new mongoose.Types.ObjectId(),
        itemName: item.itemName || item.name || "Custom Print Item",
        price: Number(item.price || 0),
        quantity: Math.max(1, Number(item.quantity || item.numberOfItem || 1)),
        dimensions: item.dimensions ? String(item.dimensions) : undefined,
        size: item.size ? String(item.size) : undefined,
        surface: item.surface ? String(item.surface) : undefined,
        finishing: item.finishing ? String(item.finishing) : undefined,
        wrapStyle: item.wrapStyle ? String(item.wrapStyle) : undefined,
        color: item.color ? String(item.color) : undefined,
        borderWidth: item.borderWidth ? String(item.borderWidth) : undefined,
        chooseFormat: item.chooseFormat ? String(item.chooseFormat) : undefined,
        shape: item.shape ? String(item.shape) : undefined,
        mattingStyle: item.mattingStyle ? String(item.mattingStyle) : undefined,
        image: item.image || (Array.isArray(item.allImages) ? item.allImages[0] : null),
        allImages: Array.isArray(item.allImages) ? item.allImages : [],
        designState: item.designState || {},
        specifications: item.specifications || {},
      }));
    } else {
      // Fetch items from active cart
      const cartQuery: Record<string, any> = {};
      if (queryUserId) cartQuery.userId = queryUserId;
      else if (querySessionId) cartQuery.sessionId = querySessionId;

      if (Object.keys(cartQuery).length > 0) {
        cartToClear = await Cart.findOne(cartQuery);
      }
      if (!cartToClear) {
        cartToClear = await Cart.findOne({}).sort({ updatedAt: -1 });
      }

      if (cartToClear && cartToClear.items && cartToClear.items.length > 0) {
        orderItems = cartToClear.items.map((item: any) => ({
          _id: new mongoose.Types.ObjectId(),
          itemName: item.itemName,
          price: item.price,
          quantity: item.quantity,
          dimensions: item.dimensions,
          size: item.size,
          surface: item.surface,
          finishing: item.finishing,
          wrapStyle: item.wrapStyle,
          color: item.color,
          borderWidth: item.borderWidth,
          chooseFormat: item.chooseFormat,
          shape: item.shape,
          mattingStyle: item.mattingStyle,
          image: item.image,
          allImages: item.allImages,
          designState: item.designState,
          specifications: item.specifications,
        }));
      }
    }

    if (orderItems.length === 0) {
      res.status(400).json({
        success: false,
        message: "Order cannot be created: No items provided and cart is empty",
      });
      return;
    }

    // Construct shipping address
    const shippingAddress = {
      fullName:
        inputShippingAddress?.fullName ||
        inputShippingAddress?.name ||
        fullName ||
        name ||
        "Customer",
      name:
        inputShippingAddress?.name ||
        inputShippingAddress?.fullName ||
        name ||
        fullName ||
        "Customer",
      email: inputShippingAddress?.email || email || "",
      phone: inputShippingAddress?.phone || phone || "",
      address:
        inputShippingAddress?.address ||
        inputShippingAddress?.street ||
        address ||
        "",
      street:
        inputShippingAddress?.street ||
        inputShippingAddress?.address ||
        address ||
        "",
      city: inputShippingAddress?.city || city || "",
      state: inputShippingAddress?.state || state || "",
      pincode: inputShippingAddress?.pincode || inputShippingAddress?.zipCode || pincode || zipCode || "",
      zipCode: inputShippingAddress?.zipCode || inputShippingAddress?.pincode || zipCode || pincode || "",
      country: inputShippingAddress?.country || country || "India",
    };

    // Construct payment details
    const paymentDetails = {
      paymentMethod:
        inputPaymentDetails?.paymentMethod || paymentMethod || "COD",
      paymentStatus:
        inputPaymentDetails?.paymentStatus || paymentStatus || "pending",
      transactionId:
        inputPaymentDetails?.transactionId || transactionId || undefined,
      paidAt:
        inputPaymentDetails?.paymentStatus === "completed" || paymentStatus === "completed"
          ? new Date()
          : undefined,
    };

    // Calculate subtotal and total
    const computedSubtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const subtotal =
      inputSubtotal !== undefined ? Number(inputSubtotal) : computedSubtotal;
    const tax = inputTax !== undefined ? Number(inputTax) : 0;
    const shippingFee =
      inputShippingFee !== undefined ? Number(inputShippingFee) : 0;
    const totalAmount =
      inputTotalAmount !== undefined
        ? Number(inputTotalAmount)
        : inputTotalPrice !== undefined
        ? Number(inputTotalPrice)
        : subtotal + tax + shippingFee;

    const orderId = generateOrderId();

    const order = new Order({
      orderId,
      userId: queryUserId || undefined,
      sessionId: querySessionId || undefined,
      items: orderItems,
      shippingAddress,
      paymentDetails,
      subtotal,
      tax,
      shippingFee,
      totalAmount,
      orderStatus: "pending",
    });

    await order.save();

    // Clear cart if requested and cart exists
    if (clearCartAfterOrder) {
      if (!cartToClear && (queryUserId || querySessionId)) {
        const query: Record<string, any> = {};
        if (queryUserId) query.userId = queryUserId;
        else if (querySessionId) query.sessionId = querySessionId;
        cartToClear = await Cart.findOne(query);
      }

      if (cartToClear) {
        cartToClear.items = [] as any;
        await cartToClear.save();
      }
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.query.userId || req.query.user) as string;
    const sessionId = (req.query.sessionId || req.headers["x-session-id"]) as string;
    const status = req.query.status as string;

    const query: Record<string, any> = {};
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;
    if (status) query.orderStatus = status;

    const orders = await Order.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { orderStatus, paymentStatus, transactionId } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    if (orderStatus) {
      order.orderStatus = orderStatus;
    }
    if (paymentStatus) {
      order.paymentDetails.paymentStatus = paymentStatus;
      if (paymentStatus === "completed" && !order.paymentDetails.paidAt) {
        order.paymentDetails.paidAt = new Date();
      }
    }
    if (transactionId) {
      order.paymentDetails.transactionId = transactionId;
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findByIdAndDelete(id);
    }
    if (!order) {
      order = await Order.findOneAndDelete({ orderId: id });
    }

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
