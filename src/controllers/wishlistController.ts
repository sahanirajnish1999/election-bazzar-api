import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Wishlist } from "../models/Wishlist.Schema";
import { Category } from "../models/Category.Schema";
import { Shape } from "../models/Shape.Schema";

// Helper to get authenticated user ID
const getAuthenticatedUserId = (req: Request): string | null => {
  if (req.user?.id) return req.user.id;
  if (req.admin?._id) return req.admin._id.toString();
  const fallback = (req.body?.userId || req.query?.userId || req.headers["x-user-id"]) as string;
  return fallback && typeof fallback === "string" ? fallback.trim() : null;
};

// Helper to resolve category by ID or Slug
const resolveCategory = async (target: string) => {
  if (mongoose.Types.ObjectId.isValid(target)) {
    const byId = await Category.findById(target);
    if (byId) return byId;
  }
  return await Category.findOne({ slug: target.toLowerCase().trim() });
};

// Helper to resolve shape by ID or Slug
const resolveShape = async (target: string, categoryId?: mongoose.Types.ObjectId | any) => {
  if (mongoose.Types.ObjectId.isValid(target)) {
    const byId = await Shape.findById(target);
    if (byId) return byId;
  }
  const query: Record<string, any> = { slug: target.toLowerCase().trim() };
  if (categoryId) query.categoryId = categoryId;
  return await Shape.findOne(query);
};

export const addToWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Valid user token is missing",
      });
      return;
    }

    const { categoryId, categorySlug, category, shapeId, shapeSlug, shape, notes } = req.body;
    const rawCategory = categoryId || categorySlug || category;

    if (!rawCategory || typeof rawCategory !== "string") {
      res.status(400).json({
        success: false,
        message: "Category ID or slug is required to add to wishlist",
      });
      return;
    }

    const resolvedCat = await resolveCategory(rawCategory);
    if (!resolvedCat) {
      res.status(404).json({
        success: false,
        message: `Category "${rawCategory}" not found`,
      });
      return;
    }

    let resolvedShapeId: mongoose.Types.ObjectId | null = null;
    const rawShape = shapeId || shapeSlug || shape;
    if (rawShape && typeof rawShape === "string") {
      const foundShape = await resolveShape(rawShape, resolvedCat._id);
      if (foundShape) {
        resolvedShapeId = foundShape._id as mongoose.Types.ObjectId;
      }
    }

    // Check if already in user's wishlist
    const existing = await Wishlist.findOne({
      userId,
      categoryId: resolvedCat._id,
      shapeId: resolvedShapeId,
    });

    if (existing) {
      const populated = await Wishlist.findById(existing._id)
        .populate("categoryId", "name slug image description status")
        .populate("shapeId", "name slug image description status");

      res.status(200).json({
        success: true,
        isWishlisted: true,
        message: "Item is already in wishlist",
        data: populated,
      });
      return;
    }

    const newItem = await Wishlist.create({
      userId,
      categoryId: resolvedCat._id,
      shapeId: resolvedShapeId,
      notes: notes && typeof notes === "string" ? notes.trim() : undefined,
    });

    const populated = await Wishlist.findById((newItem as any)._id)
      .populate("categoryId", "name slug image description status")
      .populate("shapeId", "name slug image description status");

    res.status(201).json({
      success: true,
      isWishlisted: true,
      message: "Item added to wishlist successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Valid user token is missing",
      });
      return;
    }

    const { categoryId, categorySlug, category, shapeId, shapeSlug, shape, notes } = req.body;
    const rawCategory = categoryId || categorySlug || category;

    if (!rawCategory || typeof rawCategory !== "string") {
      res.status(400).json({
        success: false,
        message: "Category ID or slug is required",
      });
      return;
    }

    const resolvedCat = await resolveCategory(rawCategory);
    if (!resolvedCat) {
      res.status(404).json({
        success: false,
        message: `Category "${rawCategory}" not found`,
      });
      return;
    }

    let resolvedShapeId: mongoose.Types.ObjectId | null = null;
    const rawShape = shapeId || shapeSlug || shape;
    if (rawShape && typeof rawShape === "string") {
      const foundShape = await resolveShape(rawShape, resolvedCat._id);
      if (foundShape) {
        resolvedShapeId = foundShape._id as mongoose.Types.ObjectId;
      }
    }

    const existing = await Wishlist.findOne({
      userId,
      categoryId: resolvedCat._id,
      shapeId: resolvedShapeId,
    });

    if (existing) {
      await Wishlist.findByIdAndDelete(existing._id);
      res.status(200).json({
        success: true,
        isWishlisted: false,
        message: "Item removed from wishlist",
        data: {
          _id: existing._id,
          categoryId: resolvedCat._id,
          categorySlug: resolvedCat.slug,
          shapeId: resolvedShapeId,
        },
      });
      return;
    }

    const newItem = await Wishlist.create({
      userId,
      categoryId: resolvedCat._id,
      shapeId: resolvedShapeId,
      notes: notes && typeof notes === "string" ? notes.trim() : undefined,
    });

    const populated = await Wishlist.findById((newItem as any)._id)
      .populate("categoryId", "name slug image description status")
      .populate("shapeId", "name slug image description status");

    res.status(200).json({
      success: true,
      isWishlisted: true,
      message: "Item added to wishlist",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const getWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid authorization token",
      });
      return;
    }

    const items = await Wishlist.find({ userId })
      .populate("categoryId", "name slug image description status")
      .populate("shapeId", "name slug image description status")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWishlistItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Valid user token is missing",
      });
      return;
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== "string") {
      res.status(400).json({
        success: false,
        message: "Wishlist item ID or category identifier is required",
      });
      return;
    }

    // 1. Try deleting by direct Wishlist item _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      const byItemId = await Wishlist.findOneAndDelete({
        _id: id,
        userId,
      });

      if (byItemId) {
        res.status(200).json({
          success: true,
          message: "Wishlist item removed successfully",
          data: { _id: byItemId._id },
        });
        return;
      }

      // 2. Try deleting by categoryId
      const byCategoryId = await Wishlist.deleteMany({
        categoryId: id,
        userId,
      });

      if (byCategoryId.deletedCount > 0) {
        res.status(200).json({
          success: true,
          message: `Removed ${byCategoryId.deletedCount} wishlist item(s) for category`,
          data: { categoryId: id, deletedCount: byCategoryId.deletedCount },
        });
        return;
      }
    }

    // 3. Try deleting by category slug
    const cat = await Category.findOne({ slug: id.toLowerCase().trim() });
    if (cat) {
      const byCatSlug = await Wishlist.deleteMany({
        categoryId: cat._id,
        userId,
      });

      if (byCatSlug.deletedCount > 0) {
        res.status(200).json({
          success: true,
          message: `Removed ${byCatSlug.deletedCount} wishlist item(s) for "${cat.name}"`,
          data: { categorySlug: cat.slug, deletedCount: byCatSlug.deletedCount },
        });
        return;
      }
    }

    res.status(404).json({
      success: false,
      message: "Wishlist item not found or does not belong to this user",
    });
  } catch (error) {
    next(error);
  }
};

export const clearWishlist = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Valid user token is missing",
      });
      return;
    }

    const result = await Wishlist.deleteMany({ userId });

    res.status(200).json({
      success: true,
      message: "Wishlist cleared successfully",
      count: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const checkWishlistStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      res.status(200).json({
        success: true,
        isWishlisted: false,
        wishlistItemId: null,
      });
      return;
    }

    const rawCategoryId = req.params.categoryId;
    const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
    const shapeId = req.query.shapeId as string | undefined;

    if (!categoryId || typeof categoryId !== "string") {
      res.status(400).json({
        success: false,
        message: "Category ID is required",
      });
      return;
    }

    const resolvedCat = await resolveCategory(categoryId);
    if (!resolvedCat) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const query: Record<string, any> = {
      userId,
      categoryId: resolvedCat._id,
    };

    if (shapeId && typeof shapeId === "string") {
      const resolvedShape = await resolveShape(shapeId, resolvedCat._id);
      if (resolvedShape) {
        query.shapeId = resolvedShape._id;
      }
    }

    const item = await Wishlist.findOne(query);

    res.status(200).json({
      success: true,
      isWishlisted: !!item,
      wishlistItemId: item?._id || null,
      data: item || null,
    });
  } catch (error) {
    next(error);
  }
};
