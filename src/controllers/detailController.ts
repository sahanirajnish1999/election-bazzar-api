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

    const shapesWithPricing = shapes.map((shape) => {
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

      return {
        _id: shape._id,
        name: shape.name,
        slug: shape.slug,
        image: shape.image,
        price: priceData,
      };
    });

    const featureDoc = await Feature.findOne({
      categoryId: category._id,
      ...childFilter,
    });
    const formattedFeatures = featureDoc
      ? stripEmptyFeatureKeys(featureDoc)
      : null;

    if (formattedFeatures) {
      delete formattedFeatures.categoryId;
      delete formattedFeatures.createdBy;
      delete formattedFeatures.createdAt;
      delete formattedFeatures.updatedAt;
    }

    res.status(200).json({
      success: true,
      message: "Details page fetched successfully",
      data: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        status: category.status,
        features: formattedFeatures,
        shapes: shapesWithPricing,
        totalShapes: shapesWithPricing.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
