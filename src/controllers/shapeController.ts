import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Shape } from "../models/Shape.Schema";
import { Category } from "../models/Category.Schema";
import { generateUniqueSlug } from "../services/slugService";
import { saveBase64Image } from "../utils/fileUpload";

export const createShape = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      name,
      slug: customSlug,
      categoryId,
      category,
      description,
      image,
      status,
    } = req.body;

    const targetCategoryId = categoryId || category;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Shape name is required",
      });
      return;
    }

    if (
      !targetCategoryId ||
      !mongoose.Types.ObjectId.isValid(targetCategoryId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid Category ID is required",
      });
      return;
    }

    // Verify category exists
    const categoryExists = await Category.findById(targetCategoryId);
    if (!categoryExists) {
      res.status(404).json({
        success: false,
        message: "Category not found with the provided ID",
      });
      return;
    }

    const slugSource =
      customSlug && typeof customSlug === "string" && customSlug.trim()
        ? customSlug.trim()
        : name.trim();

    const uniqueSlug = await generateUniqueSlug(Shape, slugSource, {
      slugField: "slug",
    });

    let imageUrl = image || null;
    if (typeof image === "string" && image.startsWith("data:image/")) {
      try {
        imageUrl = saveBase64Image(image, "shapes");
      } catch (uploadError: any) {
        res.status(400).json({
          success: false,
          message: `Failed to upload image: ${uploadError.message}`,
        });
        return;
      }
    }

    const newShape = await Shape.create({
      name: name.trim(),
      slug: uniqueSlug,
      categoryId: targetCategoryId,
      description: description ? description.trim() : undefined,
      image: imageUrl,
      status: status === "inactive" ? "inactive" : "active",
      createdBy: req.admin?._id,
    });

    const populatedShape = await newShape.populate(
      "categoryId",
      "name slug status",
    );

    res.status(201).json({
      success: true,
      message: "Shape created successfully",
      data: populatedShape,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Shape with this name or slug already exists",
      });
      return;
    }
    next(error);
  }
};

export const getShapesByCategorySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { status } = req.query;

    if (!slug || typeof slug !== "string") {
      res.status(400).json({
        success: false,
        message: "Category slug is required",
      });
      return;
    }

    const category = await Category.findOne({ slug });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const filter: Record<string, any> = { categoryId: category._id };
    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    const shapes = await Shape.find(filter)
      .populate("categoryId", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
      },
      count: shapes.length,
      data: shapes,
    });
  } catch (error) {
    next(error);
  }
};

export const getShapesByCategoryId = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { status } = req.query;

    if (
      !categoryId ||
      typeof categoryId !== "string" ||
      !mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid Category ID is required",
      });
      return;
    }

    const filter: Record<string, any> = { categoryId };
    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    const shapes = await Shape.find(filter)
      .populate("categoryId", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: shapes.length,
      data: shapes,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllShapes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { categoryId, status } = req.query;
    const filter: Record<string, any> = {};

    if (
      categoryId &&
      typeof categoryId === "string" &&
      mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      filter.categoryId = categoryId;
    }

    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    const shapes = await Shape.find(filter)
      .populate("categoryId", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: shapes.length,
      data: shapes,
    });
  } catch (error) {
    next(error);
  }
};

export const getShapeBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { slug } = req.params;

    const shape = await Shape.findOne({ slug }).populate(
      "categoryId",
      "name slug status",
    );

    if (!shape) {
      res.status(404).json({
        success: false,
        message: "Shape not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: shape,
    });
  } catch (error) {
    next(error);
  }
};
