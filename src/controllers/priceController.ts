import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Price } from "../models/Price.Schema";
import { Shape } from "../models/Shape.Schema";
import { Category } from "../models/Category.Schema";
import { Feature } from "../models/Feature.Schema";
import {
  calculateQuantityPrice,
  formatPriceWithDiscount,
} from "../services/discountService";

export const createOrUpdatePrice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { shapeId, price, basePrice, mrp, status } = req.body;

    if (!shapeId || !mongoose.Types.ObjectId.isValid(shapeId)) {
      res.status(400).json({
        success: false,
        message: "Valid Shape ID is required",
      });
      return;
    }

    const shape = await Shape.findById(shapeId);
    if (!shape) {
      res.status(404).json({
        success: false,
        message: "Shape not found with the provided ID",
      });
      return;
    }

    const finalPrice = price !== undefined ? Number(price) : Number(basePrice);
    if (isNaN(finalPrice) || finalPrice < 0) {
      res.status(400).json({
        success: false,
        message: "A valid positive price is required",
      });
      return;
    }

    const finalMrp =
      mrp !== undefined && mrp !== null && !isNaN(Number(mrp))
        ? Number(mrp)
        : null;

    const priceDoc = await Price.findOneAndUpdate(
      { shapeId: shape._id },
      {
        shapeId: shape._id,
        categoryId: shape.categoryId,
        price: finalPrice,
        mrp: finalMrp,
        status: status === "inactive" ? "inactive" : "active",
        createdBy: req.admin?._id,
      },
      { new: true, upsert: true, runValidators: true },
    ).populate([
      { path: "shapeId", select: "name slug status" },
      { path: "categoryId", select: "name slug status" },
    ]);

    res.status(200).json({
      success: true,
      message: "Price configured successfully for shape",
      data: formatPriceWithDiscount(priceDoc),
    });
  } catch (error) {
    next(error);
  }
};

export const updatePrice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Valid Price ID is required",
      });
      return;
    }

    const { price, basePrice, mrp, status } = req.body;
    const updateFields: Record<string, any> = {};

    const finalPrice =
      price !== undefined
        ? Number(price)
        : basePrice !== undefined
          ? Number(basePrice)
          : undefined;

    if (finalPrice !== undefined) {
      if (isNaN(finalPrice) || finalPrice < 0) {
        res.status(400).json({
          success: false,
          message: "A valid positive price is required",
        });
        return;
      }
      updateFields.price = finalPrice;
    }

    if (mrp !== undefined) {
      updateFields.mrp =
        mrp !== null && !isNaN(Number(mrp)) ? Number(mrp) : null;
    }

    if (status !== undefined) {
      updateFields.status = status === "inactive" ? "inactive" : "active";
    }

    const updatedPrice = await Price.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true },
    ).populate([
      { path: "shapeId", select: "name slug status" },
      { path: "categoryId", select: "name slug status" },
    ]);

    if (!updatedPrice) {
      res.status(404).json({
        success: false,
        message: "Price record not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Price updated successfully",
      data: formatPriceWithDiscount(updatedPrice),
    });
  } catch (error) {
    next(error);
  }
};

export const decidePriceFromShape = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const shapeId = req.params.shapeId || req.body.shapeId || req.query.shapeId;
    const requestedQty = Number(req.body.quantity || req.query.quantity || 1);

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

    if (isNaN(requestedQty) || requestedQty <= 0) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a positive number greater than 0",
      });
      return;
    }

    const priceConfig = await Price.findOne({
      shapeId,
      status: "active",
    }).populate([
      { path: "shapeId", select: "name slug image status" },
      { path: "categoryId", select: "name slug status" },
    ]);

    if (!priceConfig) {
      res.status(404).json({
        success: false,
        message: "No active price found for this shape",
      });
      return;
    }

    const calculation = calculateQuantityPrice(
      priceConfig.price,
      priceConfig.mrp,
      requestedQty,
    );

    res.status(200).json({
      success: true,
      data: {
        shape: priceConfig.shapeId,
        category: priceConfig.categoryId,
        ...calculation,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPriceByShapeId = async (
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

    const price = await Price.findOne({ shapeId }).populate([
      { path: "shapeId", select: "name slug status" },
      { path: "categoryId", select: "name slug status" },
    ]);

    if (!price) {
      res.status(404).json({
        success: false,
        message: "No price found for this shape",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatPriceWithDiscount(price),
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPrices = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { categoryId, shapeId, status } = req.query;
    const filter: Record<string, any> = {};

    if (
      categoryId &&
      typeof categoryId === "string" &&
      mongoose.Types.ObjectId.isValid(categoryId)
    ) {
      filter.categoryId = categoryId;
    }

    if (
      shapeId &&
      typeof shapeId === "string" &&
      mongoose.Types.ObjectId.isValid(shapeId)
    ) {
      filter.shapeId = shapeId;
    }

    if (status && (status === "active" || status === "inactive")) {
      filter.status = status;
    }

    const prices = await Price.find(filter)
      .populate([
        { path: "shapeId", select: "name slug status" },
        { path: "categoryId", select: "name slug status" },
      ])
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: prices.length,
      data: prices.map((p) => formatPriceWithDiscount(p)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/pricing/shapes/:productId or /api/v1/prices/shapes/:productId
 * Returns dimensions & pricing table for shapes in the 3D editor
 */
export const getPricingShapesByProductId = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { productId } = req.params;

    if (!productId || typeof productId !== "string") {
      res.status(400).json({
        success: false,
        message: "Product or Shape ID/slug is required",
      });
      return;
    }

    const clean = productId.trim();

    // 1. Resolve category by ID or slug
    let category: any = null;
    if (mongoose.Types.ObjectId.isValid(clean)) {
      category = await Category.findById(clean);
    }
    if (!category) {
      category = await Category.findOne({ slug: clean.toLowerCase() });
    }

    let shapes: any[] = [];
    if (category) {
      shapes = await Shape.find({ categoryId: category._id, status: "active" });
    } else {
      // 2. Try resolving as a direct Shape
      let shapeDoc: any = null;
      if (mongoose.Types.ObjectId.isValid(clean)) {
        shapeDoc = await Shape.findById(clean);
      }
      if (!shapeDoc) {
        shapeDoc = await Shape.findOne({ slug: clean.toLowerCase() });
      }

      if (shapeDoc) {
        shapes = [shapeDoc];
        category = await Category.findById(shapeDoc.categoryId);
      }
    }

    if (shapes.length === 0 && !category) {
      res.status(404).json({
        success: false,
        message: `Product or Shape "${clean}" not found`,
      });
      return;
    }

    const shapeIds = shapes.map((s) => s._id);

    const [prices, features] = await Promise.all([
      Price.find({ shapeId: { $in: shapeIds }, status: "active" }),
      Feature.find({
        $or: [
          ...(category ? [{ categoryId: category._id }] : []),
          { shapeId: { $in: shapeIds } },
        ],
        status: "active",
      }),
    ]);

    const defaultSizes = ["8x8 inch", "10x10 inch", "12x12 inch", "16x16 inch", "12x18 inch", "16x24 inch", "20x30 inch"];
    const defaultMaterials = ["Matte Canvas", "Glossy Canvas", "Museum Grade Canvas"];
    const defaultThicknesses = ["0.75 inch Slim", "1.5 inch Gallery Wrap"];

    const data = shapes.map((shape) => {
      const priceDoc = prices.find((p) => p.shapeId.toString() === shape._id.toString());
      const featureDoc =
        features.find((f) => f.shapeId && f.shapeId.toString() === shape._id.toString()) ||
        features.find((f) => category && f.categoryId && f.categoryId.toString() === category._id.toString()) ||
        features[0];

      const basePrice = priceDoc?.price || 199;
      const baseMrp = priceDoc?.mrp || (priceDoc?.price ? priceDoc.price * 2 : 399);

      const sizes = Array.isArray(featureDoc?.sizes) && featureDoc.sizes.length > 0 ? featureDoc.sizes : defaultSizes;
      const materials = Array.isArray(featureDoc?.materialTypes) && featureDoc.materialTypes.length > 0 ? featureDoc.materialTypes : defaultMaterials;
      const thicknesses = Array.isArray(featureDoc?.thicknesses) && featureDoc.thicknesses.length > 0 ? featureDoc.thicknesses : defaultThicknesses;

      // Build dimension and pricing matrix
      const pricingTable = sizes.map((sizeStr: string, idx: number) => {
        const increment = idx * 150;
        const sizePrice = basePrice + increment;
        const sizeMrp = baseMrp + increment * 2;
        return {
          dimension: sizeStr,
          size: sizeStr,
          price: sizePrice,
          mrp: sizeMrp,
          discountPercent: sizeMrp > sizePrice ? Math.round(((sizeMrp - sizePrice) / sizeMrp) * 100) : 0,
        };
      });

      return {
        shapeId: shape._id,
        shapeName: shape.name,
        slug: shape.slug,
        image: shape.image,
        startingPrice: basePrice,
        startingMrp: baseMrp,
        dimensions: sizes,
        sizes,
        materials,
        thicknesses,
        pricingTable,
      };
    });

    res.status(200).json({
      success: true,
      productId: category?._id || productId,
      productName: category?.name || shapes[0]?.name || "",
      productSlug: category?.slug || shapes[0]?.slug || "",
      data,
    });
  } catch (error) {
    next(error);
  }
};

