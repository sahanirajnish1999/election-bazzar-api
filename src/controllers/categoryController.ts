import { Request, Response, NextFunction } from "express";
import { Category } from "../models/Category.Schema";
import { Price } from "../models/Price.Schema";
import { Feature } from "../models/Feature.Schema";
import { stripEmptyFeatureKeys } from "./featureController";
import { formatPriceWithDiscount } from "../services/discountService";
import { generateUniqueSlug } from "../services/slugService";
import { saveBase64Image } from "../utils/fileUpload";

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
    const { status } = req.query;
    const filter: Record<string, any> = {};

    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    const categories = await Category.find(filter).sort({ createdAt: -1 });

    const categoriesWithDetails = await Promise.all(
      categories.map(async (cat) => {
        const prices = await Price.find({
          categoryId: cat._id,
          status: "active",
        }).populate("shapeId", "name slug image status");

        const formattedPrices = prices.map((p) => formatPriceWithDiscount(p));

        let startingPrice = null;
        let startingMrp = null;
        if (formattedPrices.length > 0) {
          const minPriceDoc = formattedPrices.reduce((min, current) =>
            current.price < min.price ? current : min,
          );
          startingPrice = minPriceDoc.price;
          startingMrp = minPriceDoc.mrp;
        }

        const featureDoc = await Feature.findOne({
          categoryId: cat._id,
          status: "active",
        });
        const formattedFeature = featureDoc
          ? stripEmptyFeatureKeys(featureDoc)
          : null;

        return {
          ...cat.toObject(),
          prices: formattedPrices,
          startingPrice,
          startingMrp,
          feature: formattedFeature,
          features: formattedFeature,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: categoriesWithDetails.length,
      data: categoriesWithDetails,
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
    const { slug } = req.params;

    const category = await Category.findOne({ slug });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const prices = await Price.find({
      categoryId: category._id,
      status: "active",
    }).populate("shapeId", "name slug image status");

    const formattedPrices = prices.map((p) => formatPriceWithDiscount(p));

    let startingPrice = null;
    let startingMrp = null;
    if (formattedPrices.length > 0) {
      const minPriceDoc = formattedPrices.reduce((min, current) =>
        current.price < min.price ? current : min,
      );
      startingPrice = minPriceDoc.price;
      startingMrp = minPriceDoc.mrp;
    }

    const featureDoc = await Feature.findOne({
      categoryId: category._id,
      status: "active",
    });
    const formattedFeature = featureDoc
      ? stripEmptyFeatureKeys(featureDoc)
      : null;

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        prices: formattedPrices,
        startingPrice,
        startingMrp,
        feature: formattedFeature,
        features: formattedFeature,
      },
    });
  } catch (error) {
    next(error);
  }
};
