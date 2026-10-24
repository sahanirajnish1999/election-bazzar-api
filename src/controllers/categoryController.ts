import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Category } from "../models/Category.Schema";
import { stripEmptyFeatureKeys } from "./featureController";
import { formatPriceWithDiscount } from "../services/discountService";
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

export const enrichFeatureWithPrices = (feature: any, basePrice: number = 199, baseMrp: number = 399) => {
  if (!feature) return null;
  const obj = feature.toObject ? feature.toObject() : { ...feature };

  const startP = typeof basePrice === "number" && basePrice > 0 ? basePrice : 199;
  const startM = typeof baseMrp === "number" && baseMrp > 0 ? baseMrp : Math.round(startP * 2);

  const priceModifiers: Record<string, number> = {};
  const optionPrices: Record<string, number> = {};

  const buildOptions = (arr?: string[], increments: number[] = [0, 150, 300, 500, 750]) => {
    if (!Array.isArray(arr) || arr.length === 0) return undefined;
    return arr.map((item, idx) => {
      const modifier = increments[idx] !== undefined ? increments[idx] : idx * 150;
      const optionPrice = startP + modifier;
      const optionMrp = Math.round(optionPrice * 2);

      priceModifiers[item] = modifier;
      optionPrices[item] = optionPrice;

      return {
        id: item.toLowerCase().replace(/\s+/g, "-"),
        label: item,
        name: item,
        price: optionPrice,
        mrp: optionMrp,
        priceModifier: modifier,
        additionalPrice: modifier,
      };
    });
  };

  if (Array.isArray(obj.sizes) && obj.sizes.length > 0) {
    obj.sizeOptions = buildOptions(obj.sizes, [0, 100, 250, 450, 700]);
  }

  if (Array.isArray(obj.capacities) && obj.capacities.length > 0) {
    obj.capacityOptions = buildOptions(obj.capacities, [0, 150, 300, 500]);
  }

  if (Array.isArray(obj.materialTypes) && obj.materialTypes.length > 0) {
    obj.materialOptions = buildOptions(obj.materialTypes, [0, 50, 150, 300]);
  }

  if (Array.isArray(obj.thicknesses) && obj.thicknesses.length > 0) {
    obj.thicknessOptions = buildOptions(obj.thicknesses, [0, 100, 200, 350]);
  }

  if (Array.isArray(obj.numberOfPages) && obj.numberOfPages.length > 0) {
    obj.pageOptions = buildOptions(obj.numberOfPages, [0, 150, 300, 500]);
  }

  if (Array.isArray(obj.tShirtSizes) && obj.tShirtSizes.length > 0) {
    obj.tShirtSizeOptions = buildOptions(obj.tShirtSizes, [0, 0, 50, 100, 150]);
  }

  if (Array.isArray(obj.displayLayouts) && obj.displayLayouts.length > 0) {
    obj.layoutOptions = obj.displayLayouts.map((item: any, idx: number) => {
      if (typeof item === "string") {
        const increments = [0, 400, 800, 1200];
        const modifier = increments[idx] !== undefined ? increments[idx] : idx * 300;
        const optionPrice = startP + modifier;
        priceModifiers[item] = modifier;
        optionPrices[item] = optionPrice;
        return {
          id: item.toLowerCase().replace(/\s+/g, "-"),
          label: item,
          name: item,
          price: optionPrice,
          mrp: Math.round(optionPrice * 2),
          priceModifier: modifier,
          additionalPrice: modifier,
        };
      }
      const labelVal = item.name || item.label || item.id;
      const optionPrice = item.price || (startP + (item.priceModifier || item.additionalPrice || 0));
      const optionMrp = item.mrp || Math.round(optionPrice * 2);
      const modifier = item.priceModifier ?? item.additionalPrice ?? Math.max(0, optionPrice - startP);

      priceModifiers[labelVal] = modifier;
      optionPrices[labelVal] = optionPrice;

      return {
        ...item,
        id: item.id || labelVal.toLowerCase().replace(/\s+/g, "-"),
        label: item.label || labelVal,
        name: item.name || labelVal,
        price: optionPrice,
        mrp: optionMrp,
        priceModifier: modifier,
        additionalPrice: modifier,
      };
    });
  }

  if (Array.isArray(obj.colors) && obj.colors.length > 0) {
    obj.colorOptions = obj.colors.map((hex: string) => {
      priceModifiers[hex] = 0;
      optionPrices[hex] = startP;
      return {
        id: hex,
        label: hex,
        name: hex,
        hex: hex,
        price: startP,
        mrp: startM,
        priceModifier: 0,
        additionalPrice: 0,
        isFree: true,
      };
    });
  }

  obj.optionPrices = optionPrices;
  obj.priceModifiers = priceModifiers;

  return stripEmptyFeatureKeys(obj);
};

export const buildCategoryDetails = async (category: any) => {
  const catObj = category.toObject ? category.toObject() : { ...category };

  // Fetch shapes belonging to this category
  const shapes = await Shape.find({
    categoryId: category._id,
    status: "active",
  }).sort({ createdAt: -1 });

  // Fetch prices belonging to this category
  const prices = await Price.find({
    categoryId: category._id,
    status: "active",
  }).populate("shapeId", "name slug image status");

  const formattedPrices = prices.map((p) => formatPriceWithDiscount(p));

  // Fetch all features belonging to this category or its shapes
  const shapeIds = shapes.map((s) => s._id);
  const allFeatures = await Feature.find({
    $or: [
      { categoryId: category._id },
      { shapeId: { $in: shapeIds } },
    ],
    status: "active",
  });

  // Calculate starting price & starting mrp
  let startingPrice = 199;
  let startingMrp = 399;
  if (formattedPrices.length > 0) {
    const minPriceDoc = formattedPrices.reduce((min, current) =>
      current.price < min.price ? current : min,
    );
    startingPrice = minPriceDoc.price;
    startingMrp = minPriceDoc.mrp;
  }

  // Attach individual price and features information onto each shape item in the shapes array
  const shapesWithPrices = shapes.map((shape) => {
    const shapeObj = shape.toObject ? shape.toObject() : { ...shape };
    const priceDoc = formattedPrices.find(
      (p) =>
        p.shapeId &&
        ((p.shapeId._id && p.shapeId._id.toString() === shape._id.toString()) ||
          p.shapeId.toString() === shape._id.toString()),
    );

    const sPrice = priceDoc ? priceDoc.price : startingPrice;
    const sMrp = priceDoc ? priceDoc.mrp : startingMrp;

    const featureDoc =
      allFeatures.find(
        (f) => f.shapeId && f.shapeId.toString() === shape._id.toString(),
      ) ||
      allFeatures.find(
        (f) => f.categoryId && f.categoryId.toString() === category._id.toString(),
      ) ||
      allFeatures[0];

    const enrichedShapeFeature = featureDoc
      ? enrichFeatureWithPrices(featureDoc, sPrice, sMrp)
      : null;

    return {
      ...shapeObj,
      price: sPrice,
      mrp: sMrp,
      pricing: priceDoc || null,
      priceDetails: priceDoc || null,
      feature: enrichedShapeFeature,
      features: enrichedShapeFeature,
    };
  });

  const mainFeatureDoc = allFeatures[0] || null;
  const formattedFeature = mainFeatureDoc
    ? enrichFeatureWithPrices(mainFeatureDoc, startingPrice, startingMrp)
    : null;

  return {
    ...catObj,
    shapes: shapesWithPrices,
    prices: formattedPrices,
    startingPrice,
    startingMrp,
    feature: formattedFeature,
    features: formattedFeature,
  };
};

export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, search, page: queryPage, limit: queryLimit, all, includeDetails } = req.query;
    const filter: Record<string, any> = {};

    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }];
    }

    if (all === "true" || req.query.pagination === "false") {
      const categories = await Category.find(filter).sort({ createdAt: -1 });
      const finalData =
        includeDetails === "true"
          ? await Promise.all(categories.map((cat) => buildCategoryDetails(cat)))
          : categories;

      res.status(200).json({
        success: true,
        count: finalData.length,
        total: finalData.length,
        data: finalData,
      });
      return;
    }

    const page = Math.max(1, parseInt(queryPage as string, 10) || 1);
    const limit = Math.max(1, parseInt(queryLimit as string, 10) || 100);
    const skip = (page - 1) * limit;

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Category.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    const finalData =
      includeDetails === "true"
        ? await Promise.all(categories.map((cat) => buildCategoryDetails(cat)))
        : categories;

    res.status(200).json({
      success: true,
      count: finalData.length,
      data: finalData,
      total,
      pagination: {
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
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

    const categoryDetails = await buildCategoryDetails(category);

    res.status(200).json({
      success: true,
      data: categoryDetails,
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
      ? { $or: [{ _id: slug }, { slug: slug.toLowerCase() }] }
      : { slug: slug.toLowerCase() };

    const category = await Category.findOne(filter);

    if (!category) {
      res.status(404).json({
        success: false,
        message: "Category not found",
      });
      return;
    }

    const categoryDetails = await buildCategoryDetails(category);

    res.status(200).json({
      success: true,
      data: categoryDetails,
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


