import { Request, Response, NextFunction } from "express";
import { Newsletter } from "../models/Newsletter.Schema";

/**
 * POST /api/v1/newsletter
 * Subscribes an email to the newsletter
 */
export const subscribeNewsletter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    const existing = await Newsletter.findOne({ email: cleanEmail });
    if (existing) {
      if (existing.status !== "active") {
        existing.status = "active";
        await existing.save();
      }
      res.status(200).json({
        success: true,
        message: "Subscribed successfully",
      });
      return;
    }

    await Newsletter.create({
      email: cleanEmail,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Subscribed successfully",
    });
  } catch (error) {
    next(error);
  }
};
