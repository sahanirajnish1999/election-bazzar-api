import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Cart } from "../models/Cart.Schema";
import { saveIfBase64, sanitizeImages } from "../utils/fileUpload";

// Helper to format cart response matching spec
const formatCartData = (cart: any) => {
  if (!cart) {
    return {
      items: [],
      subtotal: 0,
      total: 0,
      totalPrice: 0,
      totalQuantity: 0,
    };
  }
  const obj = cart.toObject ? cart.toObject() : { ...cart };
  const subtotal = obj.totalPrice || 0;
  const total = obj.totalPrice || 0;
  return {
    ...obj,
    subtotal,
    total,
  };
};

// Helper to extract user & session identity cleanly
const resolveCartIdentity = (req: Request) => {
  // If user is authenticated via JWT token, req.user.id is authoritative
  const authenticatedUserId = req.user?.id || null;

  // Session identifier from headers or body/query
  const sessionId = (
    (req.headers["x-session-id"] as string) ||
    (req.headers["session-id"] as string) ||
    req.body?.sessionId ||
    req.query?.sessionId
  )?.toString().trim() || null;

  // Client-passed userId fallback (only if unauthenticated)
  const explicitUserId = (req.body?.userId || req.query?.userId || req.query?.user) as string || null;

  const effectiveUserId = authenticatedUserId || explicitUserId;

  return {
    authenticatedUserId,
    effectiveUserId,
    sessionId,
  };
};

// Helper to find or initialize cart for a user / session
const getOrCreateCart = async (userId?: string | null, sessionId?: string | null): Promise<any> => {
  let cart: any = null;

  // 1. Search by userId first if authenticated/provided
  if (userId) {
    cart = await Cart.findOne({ userId });

    // If no cart by userId exists, check if user had a guest cart for this sessionId and migrate it
    if (!cart && sessionId) {
      cart = await Cart.findOne({
        sessionId,
        $or: [{ userId: null }, { userId: { $exists: false } }, { userId: "" }],
      });
      if (cart) {
        cart.userId = userId;
        await cart.save();
        return cart;
      }
    }
  } else if (sessionId) {
    // 2. Search strictly by sessionId for guests
    cart = await Cart.findOne({
      sessionId,
      $or: [{ userId: null }, { userId: { $exists: false } }, { userId: "" }],
    });
  }

  // 3. Return existing cart if found
  if (cart) {
    return cart;
  }

  // 4. Create new cart strictly for this userId or sessionId.
  // NEVER query someone else's cart!
  const newSessionId = sessionId || (userId ? `session-${userId}` : `guest-${new mongoose.Types.ObjectId().toString()}`);

  cart = new Cart({
    userId: userId || undefined,
    sessionId: newSessionId,
    items: [],
  });

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
      frame,
      frameFinish,
      wrapStyle,
      color,
      borderWidth,
      chooseFormat,
      shape,
      mattingStyle,
      hardware,
      hangingHardware,
      backingMaterial,
      displayOption,
      photoFilter,
      lamination,
      retouchServices,
      majorRetouchNotes,
      isProofRequested,
      image,
      previewImage,
      allImages,
      textLayers,
      clipartLayers,
      designState,
      state,
      specifications,
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
    const { effectiveUserId, sessionId } = resolveCartIdentity(req);

    const cart: any = await getOrCreateCart(effectiveUserId, sessionId);

    const rawPrimaryImage = image || (Array.isArray(allImages) ? allImages[0] : null);
    const processedImage = rawPrimaryImage ? saveIfBase64(rawPrimaryImage, "cart") : null;
    const processedAllImages = Array.isArray(allImages)
      ? allImages.map((img: string) => saveIfBase64(img, "cart"))
      : processedImage ? [processedImage] : [];
    const processedDesignState = designState ? sanitizeImages(designState, "cart") : {};
    const processedSpecifications = specifications ? sanitizeImages(specifications, "cart") : {};

    const newItem = {
      _id: new mongoose.Types.ObjectId(),
      itemName: itemName.trim(),
      price: itemPrice,
      quantity: itemQty,
      dimensions: dimensions ? String(dimensions).trim() : undefined,
      size: size ? String(size).trim() : undefined,
      surface: surface ? String(surface).trim() : undefined,
      finishing: finishing ? String(finishing).trim() : undefined,
      frame: frame || frameFinish ? String(frame || frameFinish).trim() : undefined,
      frameFinish: frameFinish || frame ? String(frameFinish || frame).trim() : undefined,
      wrapStyle: wrapStyle ? String(wrapStyle).trim() : undefined,
      color: color ? String(color).trim() : undefined,
      borderWidth: borderWidth ? String(borderWidth).trim() : undefined,
      chooseFormat: chooseFormat ? String(chooseFormat).trim() : undefined,
      shape: shape ? String(shape).trim() : undefined,
      mattingStyle: mattingStyle ? String(mattingStyle).trim() : undefined,
      hardware: hardware || hangingHardware ? String(hardware || hangingHardware).trim() : undefined,
      hangingHardware: hangingHardware || hardware ? String(hangingHardware || hardware).trim() : undefined,
      backingMaterial: backingMaterial || displayOption ? String(backingMaterial || displayOption).trim() : undefined,
      displayOption: displayOption || backingMaterial ? String(displayOption || backingMaterial).trim() : undefined,
      photoFilter: photoFilter ? String(photoFilter).trim() : undefined,
      lamination: lamination ? String(lamination).trim() : undefined,
      retouchServices: retouchServices ? String(retouchServices).trim() : undefined,
      majorRetouchNotes: majorRetouchNotes ? String(majorRetouchNotes).trim() : undefined,
      isProofRequested: isProofRequested !== undefined ? Boolean(isProofRequested) : false,
      image: processedImage,
      previewImage: previewImage ? saveIfBase64(previewImage, "cart") : processedImage,
      allImages: processedAllImages,
      textLayers: Array.isArray(textLayers) ? textLayers : (Array.isArray(state?.textLayers) ? state.textLayers : []),
      clipartLayers: Array.isArray(clipartLayers) ? clipartLayers : (Array.isArray(state?.clipartLayers) ? state.clipartLayers : []),
      designState: processedDesignState,
      state: state ? sanitizeImages(state, "cart") : processedDesignState,
      specifications: processedSpecifications,
    };

    cart.items.push(newItem as any);
    await cart.save();

    res.status(201).json({
      success: true,
      message: "Item added to cart successfully",
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      sessionId: cart.sessionId,
      data: formatCartData(cart),
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
    const { authenticatedUserId, effectiveUserId, sessionId } = resolveCartIdentity(req);

    let cart: any = null;

    if (authenticatedUserId) {
      // 1. Authenticated user: search strictly by token user id
      cart = await Cart.findOne({ userId: authenticatedUserId });

      // If user has no cart, but passed a sessionId with an unclaimed guest cart, claim it
      if (!cart && sessionId) {
        cart = await Cart.findOne({
          sessionId,
          $or: [{ userId: null }, { userId: { $exists: false } }, { userId: "" }],
        });
        if (cart) {
          cart.userId = authenticatedUserId;
          await cart.save();
        }
      }
    } else if (effectiveUserId) {
      cart = await Cart.findOne({ userId: effectiveUserId });
    } else if (sessionId) {
      // 2. Unauthenticated guest: search strictly by sessionId
      cart = await Cart.findOne({
        sessionId,
        $or: [{ userId: null }, { userId: { $exists: false } }, { userId: "" }],
      });
    }

    // 3. If no cart found, return empty cart. NEVER fall back to another user's cart!
    if (!cart) {
      res.status(200).json({
        success: true,
        count: 0,
        totalQuantity: 0,
        totalPrice: 0,
        data: {
          items: [],
          subtotal: 0,
          total: 0,
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
      sessionId: cart.sessionId,
      data: formatCartData(cart),
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
    const rawItemId = req.params.itemId || req.params.id;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      res.status(400).json({
        success: false,
        message: "Valid Item ID is required",
      });
      return;
    }

    const { effectiveUserId, sessionId } = resolveCartIdentity(req);

    // Build scoped query to guarantee item belongs to current user/session
    const query: Record<string, any> = { "items._id": itemId };
    if (effectiveUserId) {
      query.userId = effectiveUserId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    }

    const cart = await Cart.findOne(query);
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart item not found in your cart",
      });
      return;
    }

    const { quantity, numberOfItem, price } = req.body;
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

    const rawQty = quantity !== undefined ? quantity : numberOfItem;
    if (rawQty !== undefined) {
      const newQty = Number(rawQty);
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
      sessionId: cart.sessionId,
      data: formatCartData(cart),
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
    const rawItemId = req.params.itemId || req.params.id;
    const itemId = Array.isArray(rawItemId) ? rawItemId[0] : rawItemId;

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      res.status(400).json({
        success: false,
        message: "Valid Item ID is required",
      });
      return;
    }

    const { effectiveUserId, sessionId } = resolveCartIdentity(req);

    // Build scoped query to guarantee item belongs to current user/session
    const query: Record<string, any> = { "items._id": itemId };
    if (effectiveUserId) {
      query.userId = effectiveUserId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    }

    const cart = await Cart.findOne(query);
    if (!cart) {
      res.status(404).json({
        success: false,
        message: "Cart item not found in your cart",
      });
      return;
    }

    cart.items = cart.items.filter(
      (item: any) => item._id && item._id.toString() !== itemId
    ) as any;

    await cart.save();

    res.status(200).json({
      success: true,
      message: "Item removed",
      count: cart.items.length,
      totalQuantity: cart.totalQuantity,
      totalPrice: cart.totalPrice,
      sessionId: cart.sessionId,
      data: formatCartData(cart),
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
    const { effectiveUserId, sessionId } = resolveCartIdentity(req);
    const body = req.body || {};
    const itemId = (req.query.itemId || req.query.cartItemId || req.query.id || body.itemId || body.cartItemId || body.id) as string;

    const query: Record<string, any> = {};
    if (effectiveUserId) query.userId = effectiveUserId;
    else if (sessionId) query.sessionId = sessionId;
    else {
      // Neither user nor session provided - nothing to clear
      res.status(200).json({
        success: true,
        message: "Cart is empty",
        count: 0,
        totalQuantity: 0,
        totalPrice: 0,
        data: formatCartData(null),
      });
      return;
    }

    const cart = await Cart.findOne(query);

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
      message: itemId ? "Item removed" : "Cart cleared",
      count: cart ? cart.items.length : 0,
      totalQuantity: cart ? cart.totalQuantity : 0,
      totalPrice: cart ? cart.totalPrice : 0,
      sessionId: cart?.sessionId,
      data: formatCartData(cart),
    });
  } catch (error) {
    next(error);
  }
};
