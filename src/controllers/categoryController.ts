import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Category } from "../models/Category.Schema";
import { Shape } from "../models/Shape.Schema";
import { Feature } from "../models/Feature.Schema";
import { Price } from "../models/Price.Schema";
import { generateUniqueSlug } from "../services/slugService";
import { deleteImage, saveBase64Image } from "../utils/fileUpload";

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, slug: customSlug, description, image, status } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Category name is required",
      });
      return;
    }

    const slugSource =
      customSlug && typeof customSlug === "string" && customSlug.trim()
        ? customSlug.trim()
        : name.trim();

    const uniqueSlug = await generateUniqueSlug(Category, slugSource, {
      slugField: "slug",
    });

    let imageUrl = image || null;
    if (typeof image === "string" && image.startsWith("data:image/")) {
      try {
        imageUrl = saveBase64Image(image, "categories");
      } catch (uploadError: any) {
        res.status(400).json({
          success: false,
          message: `Failed to upload image: ${uploadError.message}`,
        });
        return;
      }
    }

    const category = await Category.create({
      name: name.trim(),
      slug: uniqueSlug,
      description: description ? description.trim() : undefined,
      image: imageUrl,
      status: status === "inactive" ? "inactive" : "active",
      createdBy: req.admin?._id,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
      return;
    }
    next(error);
  }
};

export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, search, page: queryPage, limit: queryLimit, all } = req.query;
    const filter: Record<string, any> = {};

    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }];
    }

    // Support fetching all without pagination (e.g. for dropdowns)
    if (all === "true" || req.query.pagination === "false") {
      const categories = await Category.find(filter).sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        count: categories.length,
        total: categories.length,
        data: categories,
      });
      return;
    }

    const page = Math.max(1, parseInt(queryPage as string, 10) || 1);
    const limit = Math.max(1, parseInt(queryLimit as string, 10) || 10);
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Category.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: categories.length,
      total,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Valid Category ID is required",
      });
      return;
    }

    const category = await Category.findById(id);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawSlug = req.params.slug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

    if (!slug || typeof slug !== "string") {
      res.status(400).json({
        success: false,
        message: "Category slug is required",
      });
      return;
    }

    const filter = mongoose.Types.ObjectId.isValid(slug)
      ? { $or: [{ _id: slug }, { slug }] }
      : { slug };

    const category = await Category.findOne(filter);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { name, slug: customSlug, description, image, status } = req.body;

    if (!id || typeof id !== "string") {
      res.status(400).json({
        success: false,
        message: "Category ID or slug is required",
      });
      return;
    }

    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id };

    const category = await Category.findOne(filter);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({
          success: false,
          message: "Category name must be a non-empty string",
        });
        return;
      }
      category.name = name.trim();
    }

    if (customSlug !== undefined && customSlug !== null) {
      if (typeof customSlug === "string" && customSlug.trim()) {
        const uniqueSlug = await generateUniqueSlug(
          Category,
          customSlug.trim(),
          {
            slugField: "slug",
            excludeId: category._id,
          },
        );
        category.slug = uniqueSlug;
      }
    }

    if (description !== undefined) {
      category.description =
        typeof description === "string" ? description.trim() : description;
    }

    if (image !== undefined) {
      if (typeof image === "string" && image.startsWith("data:image/")) {
        try {
          const newImageUrl = saveBase64Image(image, "categories");
          if (category.image && category.image !== newImageUrl) {
            deleteImage(category.image);
          }
          category.image = newImageUrl;
        } catch (uploadError: any) {
          res.status(400).json({
            success: false,
            message: `Failed to upload image: ${uploadError.message}`,
          });
          return;
        }
      } else if (image === null || image === "") {
        if (category.image) {
          deleteImage(category.image);
        }
        category.image = null;
      } else if (typeof image === "string") {
        category.image = image.trim();
      }
    }

    if (status !== undefined) {
      if (status === "active" || status === "inactive") {
        category.status = status;
      } else {
        res.status(400).json({
          success: false,
          message: "Status must be either 'active' or 'inactive'",
        });
        return;
      }
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Category with this name or slug already exists",
      });
      return;
    }
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!id || typeof id !== "string") {
      res.status(400).json({
        success: false,
        message: "Category ID or slug is required",
      });
      return;
    }

    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { slug: id };

    const category = await Category.findOne(filter);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    // Delete category image from disk
    if (category.image) {
      deleteImage(category.image);
    }

    // Find and delete images for related shapes
    const relatedShapes = await Shape.find({ categoryId: category._id });
    for (const shape of relatedShapes) {
      if (shape.image) {
        deleteImage(shape.image);
      }
    }

    // Cascade delete related shapes, features, and prices
    await Shape.deleteMany({ categoryId: category._id });
    await Feature.deleteMany({ categoryId: category._id });
    await Price.deleteMany({ categoryId: category._id });

    // Delete the category itself
    await Category.findByIdAndDelete(category._id);

    res.status(200).json({
      success: true,
      message: "Category and associated data deleted successfully",
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
      },
    });
  } catch (error) {
    next(error);
  }
};


