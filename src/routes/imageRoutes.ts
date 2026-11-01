import { Router } from "express";
import {
  uploadImage,
  getAllImages,
  getImageByName,
  deleteImageByName,
} from "../controllers/imageController";
import { handleUploadMiddleware } from "../middlewares/uploadMiddleware";

const router = Router();

// POST /api/v1/images/upload (Supports multipart/form-data & base64 JSON)
router.post("/upload", handleUploadMiddleware, uploadImage);

// POST /api/v1/images
router.post("/", handleUploadMiddleware, uploadImage);

// GET /api/v1/images (List uploaded images)
router.get("/", getAllImages);

// GET /api/v1/images/:filename (Get image info)
router.get("/:filename", getImageByName);

// DELETE /api/v1/images/:filename (Delete image)
router.delete("/:filename", deleteImageByName);

export default router;
