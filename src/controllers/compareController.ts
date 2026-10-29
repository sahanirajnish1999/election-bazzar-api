import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Category, ICategory } from "../models/Category.Schema";
import { Shape } from "../models/Shape.Schema";
import { Feature } from "../models/Feature.Schema";
import { Price } from "../models/Price.Schema";

// Helper to resolve a category by ID or slug
const resolveCategory = async (target: string): Promise<ICategory | null> => {
  if (!target || typeof target !== "string") return null;
  const clean = target.trim();
  if (mongoose.Types.ObjectId.isValid(clean)) {
    const byId = await Category.findById(clean);
    if (byId) return byId;
  }
  return await Category.findOne({ slug: clean.toLowerCase() });
};

// Helper to extract unique strings from string arrays
const getUniqueStrings = (arrays: (string[] | undefined)[]): string[] => {
  const set = new Set<string>();
  for (const arr of arrays) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === "string" && item.trim()) {
          set.add(item.trim());
        }
      }
    }
  }
  return Array.from(set);
};

// Helper to build comprehensive profile for a category
const getCategoryProfile = async (category: ICategory) => {
  const categoryId = category._id;

  // 1. Shapes
  const shapes = await Shape.find({ categoryId, status: "active" }).select(
    "_id name slug description image status"
  );

  // 2. Features
  const features = await Feature.find({ categoryId, status: "active" });

  const allSizes = getUniqueStrings(features.map((f) => f.sizes));
  const allMaterials = getUniqueStrings(features.map((f) => f.materialTypes));
  const allThicknesses = getUniqueStrings(features.map((f) => f.thicknesses));
  const allMatteOptions = getUniqueStrings(features.map((f) => f.matteOptions));
  const allColors = getUniqueStrings(features.map((f) => f.colors));
  const allNumberOfPages = getUniqueStrings(features.map((f) => f.numberOfPages));
  const allCapacities = getUniqueStrings(features.map((f) => f.capacities));
  const allTShirtSizes = getUniqueStrings(features.map((f) => f.tShirtSizes));

  // 3. Prices
  const prices = await Price.find({ categoryId, status: "active" }).select(
    "shapeId price mrp"
  );

  let minPrice = 0;
  let maxPrice = 0;
  let minMrp: number | null = null;
  let maxMrp: number | null = null;
  let maxDiscountPercent = 0;

  if (prices.length > 0) {
    const validPrices = prices.map((p) => p.price).filter((p) => typeof p === "number" && p >= 0);
    const validMrps = prices
      .map((p) => p.mrp)
      .filter((m): m is number => typeof m === "number" && m > 0);

    if (validPrices.length > 0) {
      minPrice = Math.min(...validPrices);
      maxPrice = Math.max(...validPrices);
    }
    if (validMrps.length > 0) {
      minMrp = Math.min(...validMrps);
      maxMrp = Math.max(...validMrps);
    }

    // Calculate max discount percentage if MRP is present
    for (const p of prices) {
      if (p.mrp && p.mrp > p.price && p.price > 0) {
        const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);
        if (discount > maxDiscountPercent) maxDiscountPercent = discount;
      }
    }
  }

  const priceRangeFormatted =
    minPrice === maxPrice && minPrice > 0
      ? `₹${minPrice}.00`
      : minPrice > 0 || maxPrice > 0
        ? `₹${minPrice}.00 – ₹${maxPrice}.00`
        : "Custom Pricing";

  return {
    _id: category._id,
    name: category.name,
    slug: category.slug,
    description: category.description || null,
    image: category.image || null,
    status: category.status,
    shapesCount: shapes.length,
    shapes: shapes.map((s) => ({
      _id: s._id,
      name: s.name,
      slug: s.slug,
      image: s.image,
      description: s.description,
    })),
    pricing: {
      minPrice,
      maxPrice,
      minMrp,
      maxMrp,
      priceRange: priceRangeFormatted,
      maxDiscountPercent: maxDiscountPercent > 0 ? `${maxDiscountPercent}% OFF` : null,
      totalPricedVariants: prices.length,
    },
    features: {
      sizes: allSizes.length > 0 ? allSizes : ["Standard Custom Sizes Available"],
      materials: allMaterials.length > 0 ? allMaterials : ["Museum-Grade Archival Canvas"],
      thicknesses: allThicknesses.length > 0 ? allThicknesses : ["Standard Gallery Wrap (0.75\")"],
      matteOptions: allMatteOptions,
      colors: allColors,
      numberOfPages: allNumberOfPages,
      capacities: allCapacities,
      tShirtSizes: allTShirtSizes,
    },
  };
};

export const compareCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query;
    const b = req.body || {};

    const rawCategory1 =
      (q.category1 || q.cat1 || q.slug1 || q.id1 || b.category1 || b.cat1 || (b.categoryIds && b.categoryIds[0]) || (b.slugs && b.slugs[0])) as string;

    const rawCategory2 =
      (q.category2 || q.cat2 || q.slug2 || q.id2 || b.category2 || b.cat2 || (b.categoryIds && b.categoryIds[1]) || (b.slugs && b.slugs[1])) as string;

    if (!rawCategory1 || !rawCategory2) {
      res.status(400).json({
        success: false,
        message: "Two categories are required for comparison. Provide category1 and category2 as slug or ID in query or request body",
        example: "/api/v1/categories/compare?category1=photo-mosaic&category2=canvas-prints",
      });
      return;
    }

    if (rawCategory1.toLowerCase().trim() === rawCategory2.toLowerCase().trim()) {
      res.status(400).json({
        success: false,
        message: "Please provide two different categories to compare",
      });
      return;
    }

    const [cat1, cat2] = await Promise.all([
      resolveCategory(rawCategory1),
      resolveCategory(rawCategory2),
    ]);

    if (!cat1) {
      res.status(404).json({
        success: false,
        message: `First category "${rawCategory1}" was not found`,
      });
      return;
    }

    if (!cat2) {
      res.status(404).json({
        success: false,
        message: `Second category "${rawCategory2}" was not found`,
      });
      return;
    }

    const [profile1, profile2] = await Promise.all([
      getCategoryProfile(cat1),
      getCategoryProfile(cat2),
    ]);

    // Compute intersections & differences
    const commonSizes = profile1.features.sizes.filter((s) => profile2.features.sizes.includes(s));
    const commonMaterials = profile1.features.materials.filter((m) => profile2.features.materials.includes(m));
    const commonThicknesses = profile1.features.thicknesses.filter((t) => profile2.features.thicknesses.includes(t));

    // Structured side-by-side comparison matrix for UI tables
    const comparisonTable = [
      {
        feature: "Starting Price",
        [profile1.slug]: profile1.pricing.minPrice > 0 ? `₹${profile1.pricing.minPrice}.00` : "Custom",
        [profile2.slug]: profile2.pricing.minPrice > 0 ? `₹${profile2.pricing.minPrice}.00` : "Custom",
      },
      {
        feature: "Price Range",
        [profile1.slug]: profile1.pricing.priceRange,
        [profile2.slug]: profile2.pricing.priceRange,
      },
      {
        feature: "Max Discount Available",
        [profile1.slug]: profile1.pricing.maxDiscountPercent || "Standard Pricing",
        [profile2.slug]: profile2.pricing.maxDiscountPercent || "Standard Pricing",
      },
      {
        feature: "Available Shapes & Layouts",
        [profile1.slug]: profile1.shapes.map((s) => s.name).join(", ") || "Standard Shape",
        [profile2.slug]: profile2.shapes.map((s) => s.name).join(", ") || "Standard Shape",
      },
      {
        feature: "Available Sizes",
        [profile1.slug]: profile1.features.sizes.join(", "),
        [profile2.slug]: profile2.features.sizes.join(", "),
      },
      {
        feature: "Canvas Materials",
        [profile1.slug]: profile1.features.materials.join(", "),
        [profile2.slug]: profile2.features.materials.join(", "),
      },
      {
        feature: "Frame Thicknesses",
        [profile1.slug]: profile1.features.thicknesses.join(", "),
        [profile2.slug]: profile2.features.thicknesses.join(", "),
      },
      {
        feature: "Color Options",
        [profile1.slug]: profile1.features.colors.length > 0 ? profile1.features.colors.join(", ") : "Full Color HD Print",
        [profile2.slug]: profile2.features.colors.length > 0 ? profile2.features.colors.join(", ") : "Full Color HD Print",
      },
    ];

    res.status(200).json({
      success: true,
      message: `Compared "${profile1.name}" with "${profile2.name}" successfully`,
      data: {
        category1: profile1,
        category2: profile2,
        comparisonTable,
        summary: {
          priceDifference: Math.abs(profile1.pricing.minPrice - profile2.pricing.minPrice),
          lowerStartingPriceCategory:
            profile1.pricing.minPrice < profile2.pricing.minPrice
              ? profile1.name
              : profile1.pricing.minPrice > profile2.pricing.minPrice
                ? profile2.name
                : "Same Starting Price",
          moreShapesCategory:
            profile1.shapesCount > profile2.shapesCount
              ? profile1.name
              : profile1.shapesCount < profile2.shapesCount
                ? profile2.name
                : "Same Variety of Shapes",
          commonSizes,
          commonMaterials,
          commonThicknesses,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
