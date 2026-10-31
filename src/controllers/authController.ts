import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { User, IUser } from "../models/User.Schema";
import { Otp } from "../models/Otp.Schema";
import { generateUserToken } from "../utils/jwtHelper";
import { saveBase64Image, isBase64DataUrl } from "../utils/fileUpload";

// In-memory cache for fast OTP validation
const memoryOtpStore = new Map<string, { otp: string; expiresAt: number }>();

const getBaseUrl = (req: Request): string => {
  const forwardedProto = req.headers["x-forwarded-proto"] as string;
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host") || "localhost:5001";
  return `${protocol}://${host}`;
};

/**
 * POST /api/v1/auth/send-otp
 * Generates and sends a 6-digit OTP to user mobile
 */
export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mobile, firstName, lastName, email } = req.body;

    if (!mobile || typeof mobile !== "string" || !mobile.trim()) {
      res.status(400).json({
        success: false,
        message: "Unable to send OTP. Please check mobile number.",
      });
      return;
    }

    const cleanMobile = mobile.trim().replace(/[^0-9+]/g, "");

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 1. Store in memory for instant lookup
    memoryOtpStore.set(cleanMobile, {
      otp,
      expiresAt: expiresAt.getTime(),
    });

    // 2. Persist in MongoDB with TTL index
    try {
      await Otp.findOneAndUpdate(
        { mobile: cleanMobile },
        {
          mobile: cleanMobile,
          email: email ? String(email).trim().toLowerCase() : "",
          otp,
          expiresAt,
          createdAt: new Date(),
        },
        { upsert: true, new: true }
      );
    } catch (dbErr) {
      console.warn("[AUTH] Failed to persist OTP to DB, relying on memory store:", dbErr);
    }

    // Development & test logging
    console.log(`\n========================================`);
    console.log(`📲 [AUTH OTP] Mobile: ${cleanMobile}`);
    console.log(`🔑 [AUTH OTP] Code  : ${otp}`);
    console.log(`⏳ [AUTH OTP] Expires: 10 minutes`);
    console.log(`========================================\n`);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/verify-otp
 * Verifies OTP code and returns signed JWT token + user profile
 */
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mobile, otp, firstName, lastName, name, email } = req.body;

    if (!mobile || !otp) {
      res.status(400).json({
        success: false,
        message: "Mobile number and OTP code are required",
      });
      return;
    }

    const cleanMobile = String(mobile).trim().replace(/[^0-9+]/g, "");
    const cleanOtp = String(otp).trim();

    let isValid = false;

    // Developer convenience test OTP
    if (process.env.NODE_ENV !== "production" && cleanOtp === "123456") {
      isValid = true;
    }

    // 1. Check in-memory store
    if (!isValid) {
      const memoryRecord = memoryOtpStore.get(cleanMobile);
      if (memoryRecord && memoryRecord.otp === cleanOtp && Date.now() <= memoryRecord.expiresAt) {
        isValid = true;
        memoryOtpStore.delete(cleanMobile);
      }
    }

    // 2. Check MongoDB collection if memory missed
    if (!isValid) {
      const dbRecord = await Otp.findOne({ mobile: cleanMobile, otp: cleanOtp });
      if (dbRecord && new Date(dbRecord.expiresAt).getTime() > Date.now()) {
        isValid = true;
        await Otp.deleteOne({ _id: dbRecord._id });
      }
    }

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Invalid OTP code or OTP expired.",
      });
      return;
    }

    // Determine full name
    const computedName =
      (name && String(name).trim()) ||
      `${firstName || ""} ${lastName || ""}`.trim() ||
      "Studio Member";

    const cleanEmail = email && typeof email === "string" ? email.toLowerCase().trim() : "";

    // Find existing user by mobile or email
    let user: IUser | null = await User.findOne({ mobile: cleanMobile });
    if (!user && cleanEmail) {
      user = await User.findOne({ email: cleanEmail });
    }

    if (!user) {
      user = await User.create({
        name: computedName,
        firstName: firstName || computedName.split(" ")[0] || "",
        lastName: lastName || computedName.split(" ").slice(1).join(" ") || "",
        email: cleanEmail,
        mobile: cleanMobile,
        profileImage: "",
        isVerified: true,
        role: "user",
      });
    } else {
      let shouldSave = false;
      if (!user.isVerified) {
        user.isVerified = true;
        shouldSave = true;
      }
      if (cleanEmail && !user.email) {
        user.email = cleanEmail;
        shouldSave = true;
      }
      if (
        computedName &&
        computedName !== "Studio Member" &&
        (!user.name || user.name === "Studio Member")
      ) {
        user.name = computedName;
        shouldSave = true;
      }
      if (shouldSave) {
        await user.save();
      }
    }

    // Sign JWT token
    const token = generateUserToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.status(200).json({
      success: true,
      token,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage || "",
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/profile
 * Retrieves profile of authenticated user
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login with a valid authorization token",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User profile not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage || "",
        isVerified: user.isVerified,
        role: user.role,
        addresses: user.addresses || [],
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/auth/profile
 * Updates profile details (name, email, mobile)
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login with a valid authorization token",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User profile not found",
      });
      return;
    }

    const { name, email, mobile, phone, firstName, lastName } = req.body;

    if (name && typeof name === "string") user.name = name.trim();
    if (firstName && typeof firstName === "string") user.firstName = firstName.trim();
    if (lastName && typeof lastName === "string") user.lastName = lastName.trim();
    if (email && typeof email === "string") user.email = email.toLowerCase().trim();

    const targetMobile = mobile || phone;
    if (targetMobile && typeof targetMobile === "string") {
      user.mobile = targetMobile.trim();
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage || "",
        isVerified: user.isVerified,
      },
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/profile/image
 * Uploads user avatar photo (multipart or base64) and saves to profile
 */
export const uploadProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please login with a valid authorization token",
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User profile not found",
      });
      return;
    }

    const baseUrl = getBaseUrl(req);
    let imageUrl = "";

    // 1. Multipart file upload
    const file = req.file || (req.files && Array.isArray(req.files) ? req.files[0] : null);
    if (file) {
      imageUrl = `${baseUrl}/uploads/images/${file.filename}`;
    }

    // 2. Base64 encoded image
    if (!imageUrl && req.body) {
      const rawBase64 = req.body.image || req.body.file || req.body.profileImage || req.body.imageUrl;
      if (rawBase64 && typeof rawBase64 === "string") {
        if (isBase64DataUrl(rawBase64) || rawBase64.startsWith("data:image/")) {
          const relativeUrl = saveBase64Image(rawBase64, "profiles");
          imageUrl = `${baseUrl}${relativeUrl}`;
        } else if (rawBase64.startsWith("http://") || rawBase64.startsWith("https://")) {
          imageUrl = rawBase64;
        }
      }
    }

    if (!imageUrl) {
      res.status(400).json({
        success: false,
        message: "No image file or valid base64 image data provided",
      });
      return;
    }

    user.profileImage = imageUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded",
      url: imageUrl,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};
