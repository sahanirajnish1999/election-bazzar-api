import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order, IOrderItem } from "../models/Order.Schema";
import { Cart } from "../models/Cart.Schema";
import { saveIfBase64, sanitizeImages } from "../utils/fileUpload";

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
      pricing,
      userId,
      sessionId,
      clearCartAfterOrder = true,
    } = req.body;

    const authenticatedUserId = req.user?.id || null;
    const queryUserId = authenticatedUserId || (userId || req.body.user?._id || null);
    const querySessionId = (
      (req.headers["x-session-id"] as string) ||
      (req.headers["session-id"] as string) ||
      sessionId
    )?.toString().trim() || null;

    let orderItems: IOrderItem[] = [];
    let cartToClear: any = null;

    // If explicit items array passed in body, use that
    if (Array.isArray(inputItems) && inputItems.length > 0) {
      orderItems = inputItems.map((item: any) => {
        const rawPrimaryImage = item.image || (Array.isArray(item.allImages) ? item.allImages[0] : null);
        const processedImage = rawPrimaryImage ? saveIfBase64(rawPrimaryImage, "orders") : null;
        const processedAllImages = Array.isArray(item.allImages)
          ? item.allImages.map((img: string) => saveIfBase64(img, "orders"))
          : processedImage ? [processedImage] : [];

        return {
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
          image: processedImage,
          allImages: processedAllImages,
          designState: item.designState ? sanitizeImages(item.designState, "orders") : {},
          specifications: item.specifications ? sanitizeImages(item.specifications, "orders") : {},
        };
      });
    } else {
      // Fetch items from user's active cart
      const cartQuery: Record<string, any> = {};
      if (queryUserId) cartQuery.userId = queryUserId;
      else if (querySessionId) cartQuery.sessionId = querySessionId;

      if (Object.keys(cartQuery).length > 0) {
        cartToClear = await Cart.findOne(cartQuery);
      }

      if (!cartToClear || !cartToClear.items || cartToClear.items.length === 0) {
        res.status(400).json({
          success: false,
          message: "Order cannot be created: No items provided and your cart is empty",
        });
        return;
      }

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
        inputShippingAddress?.streetAddress ||
        inputShippingAddress?.address ||
        inputShippingAddress?.street ||
        address ||
        "",
      street:
        inputShippingAddress?.streetAddress ||
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

    // Calculate subtotal, taxes, shipping, discount, and total
    const computedSubtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const subtotal =
      pricing?.subtotal !== undefined
        ? Number(pricing.subtotal)
        : inputSubtotal !== undefined
        ? Number(inputSubtotal)
        : computedSubtotal;

    const discount = pricing?.discount !== undefined ? Number(pricing.discount) : 0;
    const tax =
      pricing?.taxes !== undefined
        ? Number(pricing.taxes)
        : inputTax !== undefined
        ? Number(inputTax)
        : 0;

    const shippingFee =
      pricing?.shipping !== undefined
        ? Number(pricing.shipping)
        : inputShippingFee !== undefined
        ? Number(inputShippingFee)
        : 0;

    const totalAmount =
      pricing?.total !== undefined
        ? Number(pricing.total)
        : inputTotalAmount !== undefined
        ? Number(inputTotalAmount)
        : inputTotalPrice !== undefined
        ? Number(inputTotalPrice)
        : Math.max(0, subtotal - discount + tax + shippingFee);

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
      message: "Order placed successfully",
      data: {
        _id: order._id,
        orderNumber: order.orderId,
        orderId: order.orderId,
        status: "Confirmed",
        orderStatus: order.orderStatus,
        total: order.totalAmount,
        totalAmount: order.totalAmount,
        subtotal: order.subtotal,
        pricing: {
          subtotal: order.subtotal,
          discount,
          shipping: order.shippingFee,
          taxes: order.tax,
          total: order.totalAmount,
          couponCode: pricing?.couponCode,
        },
        items: order.items,
        shippingAddress: order.shippingAddress,
        paymentDetails: order.paymentDetails,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
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
    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "admin" ||
      req.user?.role === "superadmin"
    );

    const authenticatedUserId = req.user?.id || null;
    const sessionId = (
      (req.headers["x-session-id"] as string) ||
      (req.headers["session-id"] as string) ||
      req.query.sessionId
    )?.toString().trim() || null;

    const status = req.query.status as string;

    const query: Record<string, any> = {};

    if (isAdmin) {
      // Admin can view all orders, or filter by userId / sessionId
      if (req.query.userId) query.userId = req.query.userId;
      else if (sessionId) query.sessionId = sessionId;
    } else if (authenticatedUserId) {
      // Authenticated user: strictly view their own orders!
      query.userId = authenticatedUserId;
    } else if (sessionId) {
      // Guest user: strictly view orders for this session!
      query.sessionId = sessionId;
    } else {
      // Unauthenticated guest with no session: CANNOT VIEW ANY ORDERS!
      res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
      return;
    }

    if (status) {
      query.orderStatus = status;
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    const formattedOrders = orders.map((order) => {
      const obj = order.toObject ? order.toObject() : { ...order };
      return {
        ...obj,
        orderNumber: obj.orderId,
        status: obj.orderStatus === "pending" ? "Confirmed" : obj.orderStatus,
        pricing: {
          total: obj.totalAmount,
          subtotal: obj.subtotal,
          shipping: obj.shippingFee,
          taxes: obj.tax,
        },
        total: obj.totalAmount,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedOrders.length,
      data: formattedOrders,
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

    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "admin" ||
      req.user?.role === "superadmin"
    );
    const authenticatedUserId = req.user?.id || null;
    const sessionId = (
      (req.headers["x-session-id"] as string) ||
      (req.headers["session-id"] as string) ||
      req.query.sessionId
    )?.toString().trim() || null;

    const isOwner = Boolean(authenticatedUserId && order.userId && order.userId === authenticatedUserId);
    const isSessionOwner = Boolean(!order.userId && order.sessionId && sessionId && order.sessionId === sessionId);

    if (!isAdmin && !isOwner && !isSessionOwner) {
      res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this order",
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

    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "admin" ||
      req.user?.role === "superadmin"
    );
    const authenticatedUserId = req.user?.id || null;
    const isOwner = Boolean(authenticatedUserId && order.userId && order.userId === authenticatedUserId);

    if (!isAdmin && !isOwner) {
      res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to update this order",
      });
      return;
    }

    if (!isAdmin && orderStatus && orderStatus !== "cancelled") {
      res.status(403).json({
        success: false,
        message: "Only administrators can update order fulfillment status",
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

    const isAdmin = Boolean(
      req.admin ||
      req.user?.role === "admin" ||
      req.user?.role === "superadmin"
    );
    const authenticatedUserId = req.user?.id || null;
    const isOwner = Boolean(authenticatedUserId && order.userId && order.userId === authenticatedUserId);

    if (!isAdmin && (!isOwner || (order.orderStatus !== "pending" && order.orderStatus !== "cancelled"))) {
      res.status(403).json({
        success: false,
        message: "Access denied. Only administrators can delete active orders",
      });
      return;
    }

    await Order.deleteOne({ _id: order._id });

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
