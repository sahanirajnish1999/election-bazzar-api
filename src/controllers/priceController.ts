import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Price } from "../models/Price.Schema";
import { Shape } from "../models/Shape.Schema";
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
