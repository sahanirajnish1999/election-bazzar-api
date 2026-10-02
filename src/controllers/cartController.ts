import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.Schema";

// Helper to find or initialize cart for a user / session / default
const getOrCreateCart = async (userId?: string, sessionId?: string) => {
  const query: Record<string, any> = {};
  if (userId) {
    query.userId = userId;
  } else if (sessionId) {
    query.sessionId = sessionId;
  }

  let cart = null;
  if (Object.keys(query).length > 0) {
    cart = await Cart.findOne(query);
  }

  if (!cart) {
    cart = await Cart.findOne({}).sort({ updatedAt: -1 });
  }

  if (!cart) {
    cart = new Cart({
      userId: userId || undefined,
      sessionId: sessionId || "default-session",
      items: [],
    });
  }
  return cart;
};

export const addToCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      itemName,
      price,
      quantity,
      numberOfItem,
      dimensions,
      size,
      surface,
      finishing,
      wrapStyle,
      color,
      borderWidth,
      chooseFormat,
      shape,
      mattingStyle,
      image,
      allImages,
      designState,
      specifications,
      userId,
      sessionId,
    } = req.body;

    if (!itemName || typeof itemName !== "string" || !itemName.trim()) {
      res.status(400).json({
        success: false,
        message: "Item name is required",
      });
      return;
    }

    const itemPrice = Number(price);
    if (isNaN(itemPrice) || itemPrice < 0) {
      res.status(400).json({
        success: false,
        message: "Valid non-negative price is required",
      });
      return;
    }

    const itemQty = Math.max(1, Number(quantity || numberOfItem || 1));

    const cart = await getOrCreateCart(
      userId || req.body.user?._id,
      sessionId || (req.headers["x-session-id"] as string)
    );

    const newItem = {
      _id: new mongoose.Types.ObjectId(),
      itemName: itemName.trim(),
      price: itemPrice,
      quantity: itemQty,
      dimensions: dimensions ? String(dimensions).trim() : undefined,
      size: size ? String(size).trim() : undefined,
      surface: surface ? String(surface).trim() : undefined,
      finishing: finishing ? String(finishing).trim() : undefined,
      wrapStyle: wrapStyle ? String(wrapStyle).trim() : undefined,
      color: color ? String(color).trim() : undefined,
      borderWidth: borderWidth ? String(borderWidth).trim() : undefined,
      chooseFormat: chooseFormat ? String(chooseFormat).trim() : undefined,
      shape: shape ? String(shape).trim() : undefined,
      mattingStyle: mattingStyle ? String(mattingStyle).trim() : undefined,
      image: image || (Array.isArray(allImages) ? allImages[0] : null),
      allImages: Array.isArray(allImages) ? allImages : [],
      designState: designState || {},
      specifications: specifications || {},
    };

    cart.items.push(newItem as any);
    await cart.save();

    res.status(201).json({
      success: true,
      message: "Item added to cart successfully",
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const getCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req.query.userId || req.query.user) as string;
    const sessionId = (req.query.sessionId || req.headers["x-session-id"]) as string;

    const query: Record<string, any> = {};
    if (userId) {
      query.userId = userId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    }

    let cart = null;
    if (Object.keys(query).length > 0) {
      cart = await Cart.findOne(query);
    }

    if (!cart) {
      cart = await Cart.findOne({}).sort({ updatedAt: -1 });
    }

    if (!cart) {
      res.status(200).json({
        success: true,
        count: 0,
        totalQuantity: 0,
        totalPrice: 0,
        data: {
          items: [],
          totalPrice: 0,
          totalQuantity: 0,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawItemId = req.params.itemId;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      res.status(400).json({
        success: false,
        message: "Valid Item ID is required",
      });
      return;
    }

    const cart = await Cart.findOne({ "items._id": itemId });
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
      return;
    }

    const { quantity, price } = req.body;
    const targetItem = cart.items.find(
      (item: any) => item._id && item._id.toString() === itemId
    );

    if (!targetItem) {
      res.status(404).json({
        success: false,
        message: "Cart item not found inside cart",
      });
      return;
    }

    if (quantity !== undefined) {
      const newQty = Number(quantity);
      if (isNaN(newQty) || newQty <= 0) {
        cart.items = cart.items.filter(
          (item: any) => item._id && item._id.toString() !== itemId
        ) as any;
      } else {
        targetItem.quantity = newQty;
      }
    }

    if (price !== undefined) {
      const newPrice = Number(price);
      if (!isNaN(newPrice) && newPrice >= 0) {
        targetItem.price = newPrice;
      }
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCartItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawItemId = req.params.itemId;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      res.status(400).json({
        success: false,
        message: "Valid Item ID is required",
      });
      return;
    }

    const cart = await Cart.findOne({ "items._id": itemId });
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
      return;
    }

    cart.items = cart.items.filter(
      (item: any) => item._id && item._id.toString() !== itemId
    ) as any;

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

export const clearCart = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body || {};
    const userId = (req.query.userId || body.userId) as string;
    const sessionId = (req.query.sessionId || body.sessionId || req.headers["x-session-id"]) as string;
    const itemId = (req.query.itemId || req.query.cartItemId || req.query.id || body.itemId || body.cartItemId || body.id) as string;

    const query: Record<string, any> = {};
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    let cart = null;
    if (Object.keys(query).length > 0) {
      cart = await Cart.findOne(query);
    }
    if (!cart) {
      cart = await Cart.findOne({}).sort({ updatedAt: -1 });
    }

    if (cart) {
      if (itemId) {
        cart.items = cart.items.filter(
          (item: any) => item._id && item._id.toString() !== String(itemId)
        ) as any;
      } else {
        cart.items = [] as any;
      }
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: itemId ? "Cart item removed successfully" : "Cart cleared successfully",
      count: cart ? cart.items.length : 0,
      totalQuantity: cart ? cart.totalQuantity : 0,
      totalPrice: cart ? cart.totalPrice : 0,
      data: cart || { items: [], totalPrice: 0, totalQuantity: 0 },
    });
  } catch (error) {
    next(error);
  }
};
