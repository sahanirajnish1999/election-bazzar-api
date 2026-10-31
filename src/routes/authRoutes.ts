import { Router } from "express";
import {
  sendOtp,
  verifyOtp,
  getProfile,
  updateProfile,
  uploadProfileImage,
} from "../controllers/authController";
import { authenticateUser } from "../middlewares/authMiddleware";
import { handleUploadMiddleware } from "../middlewares/uploadMiddleware";

const router = Router();

// POST /api/v1/auth/send-otp - Sends an OTP via SMS/Email to user mobile
router.post("/send-otp", sendOtp);

// POST /api/v1/auth/verify-otp - Verifies OTP and returns JWT token + user profile
router.post("/verify-otp", verifyOtp);

// GET /api/v1/auth/profile - Fetches authenticated user profile
router.get("/profile", authenticateUser, getProfile);

// PUT /api/v1/auth/profile - Updates user profile details
router.put("/profile", authenticateUser, updateProfile);

// POST /api/v1/auth/profile/image - Uploads user avatar / profile image
router.post("/profile/image", authenticateUser, handleUploadMiddleware, uploadProfileImage);

export default router;
