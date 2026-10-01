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

    // 1. Fetch shapes belonging to this category
    const shapes = await Shape.find({
      categoryId: category._id,
      ...childFilter,
    }).sort({ createdAt: 1 });

    // 2. Fetch prices associated with these shapes
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

    // 3. Combine each shape with its formatted price & discount calculations
    const shapesWithPricing = shapes.map((shape) => {
      const shapeObj = shape.toObject ? shape.toObject() : { ...shape };
      const priceDoc = priceMap.get(shape._id.toString());
      if (priceDoc) {
        const formattedPrice = formatPriceWithDiscount(priceDoc);
        return {
          ...shapeObj,
          price: {
            _id: formattedPrice._id,
            price: formattedPrice.price,
            mrp: formattedPrice.mrp,
            discountAmount: formattedPrice.discountAmount,
            discountPercentage: formattedPrice.discountPercentage,
            formattedDiscount: formattedPrice.formattedDiscount,
            hasDiscount: formattedPrice.hasDiscount,
            status: formattedPrice.status,
          },
        };
      }
      return {
        ...shapeObj,
        price: null,
      };
    });

    // 4. Fetch features for this category
    const featureDoc = await Feature.findOne({
      categoryId: category._id,
      ...childFilter,
    });
    const formattedFeatures = featureDoc
      ? stripEmptyFeatureKeys(featureDoc)
      : null;

    // 5. Calculate price range and summary for the category
    const activePrices = shapesWithPricing
      .map((s) => s.price)
      .filter((p): p is NonNullable<typeof p> =>
        Boolean(p && p.status !== "inactive" && typeof p.price === "number"),
      );

    let pricingSummary = null;
    if (activePrices.length > 0) {
      const numericPrices = activePrices.map((p) => p.price);
      const numericMrps = activePrices
        .map((p) => p.mrp)
        .filter((m): m is number => typeof m === "number" && !isNaN(m));

      const minPrice = Math.min(...numericPrices);
      const maxPrice = Math.max(...numericPrices);
      const minMrp = numericMrps.length > 0 ? Math.min(...numericMrps) : null;
      const maxMrp = numericMrps.length > 0 ? Math.max(...numericMrps) : null;
      const hasDiscount = activePrices.some((p) => p.hasDiscount);

      pricingSummary = {
        minPrice,
        maxPrice,
        minMrp,
        maxMrp,
        hasDiscount,
        formattedRange:
          minPrice === maxPrice
            ? `₹${minPrice}`
            : `₹${minPrice} - ₹${maxPrice}`,
      };
    }

    const categoryObj = category.toObject
      ? category.toObject()
      : { ...category };

    res.status(200).json({
      success: true,
      message: "Category details page fetched successfully",
      data: {
        ...categoryObj,
        // category: categoryObj,
        features: formattedFeatures,
        shapes: shapesWithPricing,
        totalShapes: shapesWithPricing.length,
        pricingSummary,
      },
    });
  } catch (error) {
    next(error);
  }
};
