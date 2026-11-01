import { Request, Response, NextFunction } from "express";
import { Category } from "../models/Category.Schema";
import { buildCategoryDetails, getCategoryBySlug } from "./categoryController";

/**
 * GET /api/v1/products
 * Returns array of all active products with enriched shapes, options, and pricing
 */
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status = "active", search } = req.query;
    const filter: Record<string, any> = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: searchRegex }, { slug: searchRegex }];
    }

    const categories = await Category.find(filter).sort({ createdAt: -1 });
    const products = await Promise.all(categories.map((cat) => buildCategoryDetails(cat)));

    res.status(200).json({
      success: true,
      count: products.length,
      total: products.length,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/products/:slug
 * Returns single product data for a slug or ID
 */
export const getProductBySlug = getCategoryBySlug;
