import { Request, Response, NextFunction } from "express";
import { Category } from "../models/Category.Schema";
import { Shape } from "../models/Shape.Schema";
import { Feature } from "../models/Feature.Schema";
import { Price } from "../models/Price.Schema";
import { stripEmptyFeatureKeys } from "./featureController";
import { formatPriceWithDiscount } from "../services/discountService";

export const getDetailsByCategorySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawSlug = req.params.slug || (req.query.slug as string);

    if (!rawSlug || typeof rawSlug !== "string" || !rawSlug.trim()) {
      res.status(400).json({
        success: false,
        message: "Category slug is required",
      });
      return;
    }

    const slug = rawSlug.trim().toLowerCase();
    const { status } = req.query;

    const category = await Category.findOne({
      $or: [{ slug }, { slug: rawSlug.trim() }],
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const childFilter: Record<string, any> = {};
    if (status && (status === "active" || status === "inactive")) {
      childFilter.status = status;
    }

    const shapes = await Shape.find({
      categoryId: category._id,
      ...childFilter,
    }).sort({ createdAt: 1 });
    const shapeIds = shapes.map((shape) => shape._id);
    const priceFilter: Record<string, any> = {
      shapeId: { $in: shapeIds },
    };
    if (status && (status === "active" || status === "inactive")) {
      priceFilter.status = status;
    }

    const prices = await Price.find(priceFilter);
    const priceMap = new Map<string, any>();
    for (const price of prices) {
      priceMap.set(price.shapeId.toString(), price);
    }

    const featureFilter: Record<string, any> = {
      shapeId: { $in: shapeIds },
    };
    if (status && (status === "active" || status === "inactive")) {
      featureFilter.status = status;
    }

    const features = await Feature.find(featureFilter);
    const featureMap = new Map<string, any>();
    for (const feat of features) {
      featureMap.set(feat.shapeId.toString(), feat);
    }

    let fallbackCategoryFeature: any = null;
    if (features.length === 0) {
      const catFeatDoc = await Feature.findOne({
        categoryId: category._id,
        ...childFilter,
      });
      if (catFeatDoc) {
        fallbackCategoryFeature = stripEmptyFeatureKeys(catFeatDoc);
        delete fallbackCategoryFeature.categoryId;
        delete fallbackCategoryFeature.shapeId;
        delete fallbackCategoryFeature.createdBy;
        delete fallbackCategoryFeature.createdAt;
        delete fallbackCategoryFeature.updatedAt;
        delete fallbackCategoryFeature.status;
      }
    }

    const shapesWithDetails = shapes.map((shape) => {
      const priceDoc = priceMap.get(shape._id.toString());
      let priceData = null;

      if (priceDoc) {
        const formattedPrice = formatPriceWithDiscount(priceDoc);
        priceData = {
          price: formattedPrice.price,
          mrp: formattedPrice.mrp,
          discountAmount: formattedPrice.discountAmount,
          formattedDiscount: formattedPrice.formattedDiscount,
        };
      }

      const featureDoc = featureMap.get(shape._id.toString());
      let featureData = null;
      if (featureDoc) {
        const formatted = stripEmptyFeatureKeys(featureDoc);
        delete formatted.categoryId;
        delete formatted.shapeId;
        delete formatted.createdBy;
        delete formatted.createdAt;
        delete formatted.updatedAt;
        delete formatted.status;
        featureData = formatted;
      } else if (fallbackCategoryFeature) {
        featureData = { ...fallbackCategoryFeature };
      }

      return {
        _id: shape._id,
        name: shape.name,
        slug: shape.slug,
        image: shape.image,
        price: priceData,
        features: featureData,
      };
    });

    res.status(200).json({
      success: true,
      message: "Details page fetched successfully",
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        shapes: shapesWithDetails,
        totalShapes: shapesWithDetails.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
