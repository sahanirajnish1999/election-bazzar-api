import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Feature } from "../models/Feature.Schema";
import { Category } from "../models/Category.Schema";
import { Shape } from "../models/Shape.Schema";
import { Price } from "../models/Price.Schema";
import { formatPriceWithDiscount } from "../services/discountService";
import { enrichFeatureWithPrices } from "./categoryController";

const parseStringArray = (input: any): string[] => {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof input === "string" && input.trim()) {
    return input
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const stripEmptyFeatureKeys = (feature: any) => {
  if (!feature) return feature;
  const obj = feature.toObject ? feature.toObject() : { ...feature };
  const optionKeys = [
    "colors",
    "materialTypes",
    "sizes",
    "thicknesses",
    "numberOfPages",
    "matteOptions",
    "capacities",
    "tShirtSizes",
    "displayLayouts",
  ];
  for (const key of optionKeys) {
    if (!obj[key] || (Array.isArray(obj[key]) && obj[key].length === 0)) {
      delete obj[key];
    }
  }
  return obj;
};

export const enrichFeatureWithPriceLookup = async (
  feature: any,
  priceMap?: Map<string, { price: number; mrp: number }>,
) => {
  if (!feature) return null;
  const obj = feature.toObject ? feature.toObject() : { ...feature };

  const shapeId = (obj.shapeId?._id || obj.shapeId)?.toString();
  const categoryId = (obj.categoryId?._id || obj.categoryId)?.toString();

  let basePrice = 199;
  let baseMrp = 399;

  if (priceMap) {
    if (shapeId && priceMap.has(`shape_${shapeId}`)) {
      const p = priceMap.get(`shape_${shapeId}`)!;
      basePrice = p.price;
      baseMrp = p.mrp;
    } else if (categoryId && priceMap.has(`cat_${categoryId}`)) {
      const p = priceMap.get(`cat_${categoryId}`)!;
      basePrice = p.price;
      baseMrp = p.mrp;
    }
  } else {
    let priceDoc = null;
    if (shapeId) {
      priceDoc = await Price.findOne({ shapeId, status: "active" });
    }
    if (!priceDoc && categoryId) {
      priceDoc = await Price.findOne({ categoryId, status: "active" });
    }
    if (priceDoc) {
      const formatted = formatPriceWithDiscount(priceDoc);
      basePrice = formatted.price;
      baseMrp = formatted.mrp;
    }
  }

  return enrichFeatureWithPrices(feature, basePrice, baseMrp);
};

export const enrichFeaturesListWithPriceLookup = async (features: any[]) => {
  if (!Array.isArray(features) || features.length === 0) return [];

  const activePrices = await Price.find({ status: "active" });
  const priceMap = new Map<string, { price: number; mrp: number }>();

  for (const priceDoc of activePrices) {
    const formatted = formatPriceWithDiscount(priceDoc);
    if (priceDoc.shapeId) {
      priceMap.set(`shape_${priceDoc.shapeId.toString()}`, {
        price: formatted.price,
        mrp: formatted.mrp,
      });
    }
    if (priceDoc.categoryId) {
      priceMap.set(`cat_${priceDoc.categoryId.toString()}`, {
        price: formatted.price,
        mrp: formatted.mrp,
      });
    }
  }

  return Promise.all(
    features.map((f) => enrichFeatureWithPriceLookup(f, priceMap)),
  );
};

export const createOrUpdateFeature = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      shapeId,
      shape,
      colors,
      color,
      materialTypes,
      materialType,
      materials,
      material,
      sizes,
      size,
      thicknesses,
      thickness,
      numberOfPages,
      numberOfPage,
      pages,
      matteOptions,
      matteOption,
      capacities,
      capacity,
      tShirtSizes,
      tShirtsSize,
      tshirtSize,
      tshirtSizes,
      displayLayouts,
      displayLayout,
      layouts,
      layout,
      description,
      status,
    } = req.body;

    const targetInput =
      shapeId ||
      shape ||
      req.body.categoryId ||
      req.body.category ||
      req.body.id;

    if (!targetInput || typeof targetInput !== "string" || !targetInput.trim()) {
      res.status(400).json({
        success: false,
        message: "Valid Shape ID, Category ID, or Slug is required",
      });
      return;
    }

    const inputStr = targetInput.trim();
    let shapeExists = null;

    if (mongoose.Types.ObjectId.isValid(inputStr)) {
      shapeExists = await Shape.findById(inputStr);
      if (!shapeExists) {
        shapeExists = await Shape.findOne({ categoryId: inputStr });
      }
    }

    if (!shapeExists) {
      shapeExists = await Shape.findOne({ slug: inputStr.toLowerCase() });
    }

    if (!shapeExists) {
      const cat = await Category.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(inputStr) ? [{ _id: inputStr }] : []),
          { slug: inputStr.toLowerCase() },
        ],
      });
      if (cat) {
        shapeExists = await Shape.findOne({ categoryId: cat._id });
      }
    }

    if (!shapeExists) {
      res.status(404).json({
        success: false,
        message: "Shape or Category not found with the provided identifier",
      });
      return;
    }

    const featureData: Record<string, any> = {
      shapeId: shapeExists._id,
      categoryId: shapeExists.categoryId,
      description: description ? description.trim() : undefined,
      status: status === "inactive" ? "inactive" : "active",
      createdBy: req.admin?._id,
    };

    const addIfNotEmpty = (key: string, arr: string[]) => {
      if (arr.length > 0) {
        featureData[key] = arr;
      }
    };

    addIfNotEmpty("colors", parseStringArray(colors || color));
    addIfNotEmpty(
      "materialTypes",
      parseStringArray(materialTypes || materialType || materials || material),
    );
    addIfNotEmpty("sizes", parseStringArray(sizes || size));
    addIfNotEmpty("thicknesses", parseStringArray(thicknesses || thickness));
    addIfNotEmpty(
      "numberOfPages",
      parseStringArray(numberOfPages || numberOfPage || pages),
    );
    addIfNotEmpty(
      "matteOptions",
      parseStringArray(matteOptions || matteOption),
    );
    addIfNotEmpty("capacities", parseStringArray(capacities || capacity));
    addIfNotEmpty(
      "tShirtSizes",
      parseStringArray(tShirtSizes || tShirtsSize || tshirtSize || tshirtSizes),
    );
    addIfNotEmpty(
      "displayLayouts",
      parseStringArray(displayLayouts || displayLayout || layouts || layout),
    );

    const feature = await Feature.findOneAndUpdate(
      { shapeId: shapeExists._id },
      featureData,
      { new: true, upsert: true, runValidators: true },
    )
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status");

    const enrichedData = await enrichFeatureWithPriceLookup(feature);

    res.status(200).json({
      success: true,
      message: "Features configured successfully for shape",
      data: enrichedData,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllFeatures = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { categoryId, shapeId, status } = req.query;
    const filter: Record<string, any> = {};

    if (
      shapeId &&
      typeof shapeId === "string" &&
      mongoose.Types.ObjectId.isValid(shapeId)
    ) {
      filter.shapeId = shapeId;
    }

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

    const features = await Feature.find(filter)
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status")
      .sort({ createdAt: -1 });

    const enrichedFeatures = await enrichFeaturesListWithPriceLookup(features);

    res.status(200).json({
      success: true,
      count: enrichedFeatures.length,
      data: enrichedFeatures,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeatureById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Valid Feature ID is required",
      });
      return;
    }

    const feature = await Feature.findById(id)
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status");

    if (!feature) {
      res.status(404).json({
        success: false,
        message: "Feature not found",
      });
      return;
    }

    const enrichedData = await enrichFeatureWithPriceLookup(feature);

    res.status(200).json({
      success: true,
      data: enrichedData,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeatureByShapeId = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { shapeId } = req.params;

    if (
      !shapeId ||
      typeof shapeId !== "string" ||
      !mongoose.Types.ObjectId.isValid(shapeId)
    ) {
      res.status(400).json({
        success: false,
        message: "Valid Shape ID is required",
      });
      return;
    }

    const feature = await Feature.findOne({ shapeId })
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status");

    if (!feature) {
      res.status(404).json({
        success: false,
        message: "No features configured for this shape",
      });
      return;
    }

    const enrichedData = await enrichFeatureWithPriceLookup(feature);

    res.status(200).json({
      success: true,
      data: enrichedData,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeaturesByCategorySlug = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { slug } = req.params;

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

    const features = await Feature.find({
      categoryId: category._id,
      status: "active",
    })
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status");

    if (!features || features.length === 0) {
      res.status(404).json({
        success: false,
        message: "No features configured for this category yet",
      });
      return;
    }

    const enrichedFeatures = await enrichFeaturesListWithPriceLookup(features);

    res.status(200).json({
      success: true,
      count: enrichedFeatures.length,
      data: enrichedFeatures,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFeature = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Valid Feature ID is required",
      });
      return;
    }

    const {
      shapeId,
      shape,
      colors,
      color,
      materialTypes,
      materialType,
      materials,
      material,
      sizes,
      size,
      thicknesses,
      thickness,
      numberOfPages,
      numberOfPage,
      pages,
      matteOptions,
      matteOption,
      capacities,
      capacity,
      tShirtSizes,
      tShirtsSize,
      tshirtSize,
      tshirtSizes,
      displayLayouts,
      displayLayout,
      layouts,
      layout,
      description,
      status,
    } = req.body;

    const updateFields: Record<string, any> = {};

    const targetShapeId = shapeId || shape;
    if (targetShapeId) {
      if (
        typeof targetShapeId !== "string" ||
        !mongoose.Types.ObjectId.isValid(targetShapeId)
      ) {
        res.status(400).json({
          success: false,
          message: "Valid Shape ID is required",
        });
        return;
      }
      const shapeDoc = await Shape.findById(targetShapeId);
      if (!shapeDoc) {
        res.status(404).json({
          success: false,
          message: "Shape not found with the provided ID",
        });
        return;
      }
      updateFields.shapeId = shapeDoc._id;
      updateFields.categoryId = shapeDoc.categoryId;
    }

    if (colors !== undefined || color !== undefined) {
      const arr = parseStringArray(colors !== undefined ? colors : color);
      updateFields.colors = arr.length > 0 ? arr : undefined;
    }

    if (
      materialTypes !== undefined ||
      materialType !== undefined ||
      materials !== undefined ||
      material !== undefined
    ) {
      const arr = parseStringArray(
        materialTypes !== undefined
          ? materialTypes
          : materialType !== undefined
            ? materialType
            : materials !== undefined
              ? materials
              : material,
      );
      updateFields.materialTypes = arr.length > 0 ? arr : undefined;
    }

    if (sizes !== undefined || size !== undefined) {
      const arr = parseStringArray(sizes !== undefined ? sizes : size);
      updateFields.sizes = arr.length > 0 ? arr : undefined;
    }

    if (thicknesses !== undefined || thickness !== undefined) {
      const arr = parseStringArray(
        thicknesses !== undefined ? thicknesses : thickness,
      );
      updateFields.thicknesses = arr.length > 0 ? arr : undefined;
    }

    if (
      numberOfPages !== undefined ||
      numberOfPage !== undefined ||
      pages !== undefined
    ) {
      const arr = parseStringArray(
        numberOfPages !== undefined
          ? numberOfPages
          : numberOfPage !== undefined
            ? numberOfPage
            : pages,
      );
      updateFields.numberOfPages = arr.length > 0 ? arr : undefined;
    }

    if (matteOptions !== undefined || matteOption !== undefined) {
      const arr = parseStringArray(
        matteOptions !== undefined ? matteOptions : matteOption,
      );
      updateFields.matteOptions = arr.length > 0 ? arr : undefined;
    }

    if (capacities !== undefined || capacity !== undefined) {
      const arr = parseStringArray(
        capacities !== undefined ? capacities : capacity,
      );
      updateFields.capacities = arr.length > 0 ? arr : undefined;
    }

    if (
      tShirtSizes !== undefined ||
      tShirtsSize !== undefined ||
      tshirtSize !== undefined ||
      tshirtSizes !== undefined
    ) {
      const arr = parseStringArray(
        tShirtSizes !== undefined
          ? tShirtSizes
          : tShirtsSize !== undefined
            ? tShirtsSize
            : tshirtSize !== undefined
              ? tshirtSize
              : tshirtSizes,
      );
      updateFields.tShirtSizes = arr.length > 0 ? arr : undefined;
    }

    if (
      displayLayouts !== undefined ||
      displayLayout !== undefined ||
      layouts !== undefined ||
      layout !== undefined
    ) {
      const arr = parseStringArray(
        displayLayouts !== undefined
          ? displayLayouts
          : displayLayout !== undefined
            ? displayLayout
            : layouts !== undefined
              ? layouts
              : layout,
      );
      updateFields.displayLayouts = arr.length > 0 ? arr : undefined;
    }

    if (description !== undefined) {
      updateFields.description =
        typeof description === "string" ? description.trim() : description;
    }

    if (status !== undefined) {
      updateFields.status = status === "inactive" ? "inactive" : "active";
    }

    const updatedFeature = await Feature.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    )
      .populate("shapeId", "name slug status image")
      .populate("categoryId", "name slug status");

    if (!updatedFeature) {
      res.status(404).json({
        success: false,
        message: "Feature not found",
      });
      return;
    }

    const enrichedData = await enrichFeatureWithPriceLookup(updatedFeature);

    res.status(200).json({
      success: true,
      message: "Feature updated successfully",
      data: enrichedData,
    });
  } catch (error) {
    next(error);
  }
};
