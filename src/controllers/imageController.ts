import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { saveBase64Image, isBase64DataUrl } from "../utils/fileUpload";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "images");

const getBaseUrl = (req: Request): string => {
  const forwardedProto = req.headers["x-forwarded-proto"] as string;
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host") || "localhost:5001";
  return `${protocol}://${host}`;
};

export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const baseUrl = getBaseUrl(req);
    const uploadedFiles: Array<{
      filename: string;
      relativeUrl: string;
      url: string;
      imageUrl: string;
      size: number;
      mimetype: string;
    }> = [];

    // 1. Check if files were uploaded via multipart/form-data
    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (filesMap) {
      for (const field of Object.keys(filesMap)) {
        for (const file of filesMap[field]) {
          const relativeUrl = `/uploads/images/${file.filename}`;
          uploadedFiles.push({
            filename: file.filename,
            relativeUrl,
            url: `${baseUrl}${relativeUrl}`,
            imageUrl: `${baseUrl}${relativeUrl}`,
            size: file.size,
            mimetype: file.mimetype,
          });
        }
      }
    } else if (req.file) {
      const file = req.file;
      const relativeUrl = `/uploads/images/${file.filename}`;
      uploadedFiles.push({
        filename: file.filename,
        relativeUrl,
        url: `${baseUrl}${relativeUrl}`,
        imageUrl: `${baseUrl}${relativeUrl}`,
        size: file.size,
        mimetype: file.mimetype,
      });
    }

    // 2. Check if image was sent as base64 in JSON body
    if (uploadedFiles.length === 0 && req.body) {
      const rawBase64 =
        req.body.image ||
        req.body.file ||
        req.body.base64 ||
        req.body.data ||
        req.body.imageUrl;

      if (rawBase64 && typeof rawBase64 === "string") {
        const folderName = req.body.folder || "images";
        const relativeUrl = saveBase64Image(rawBase64, folderName);
        const filename = path.basename(relativeUrl);
        const fullFilePath = path.join(process.cwd(), relativeUrl.startsWith("/") ? relativeUrl.slice(1) : relativeUrl);
        let size = 0;
        try {
          size = fs.statSync(fullFilePath).size;
        } catch {
          // ignore
        }

        uploadedFiles.push({
          filename,
          relativeUrl,
          url: `${baseUrl}${relativeUrl}`,
          imageUrl: `${baseUrl}${relativeUrl}`,
          size,
          mimetype: rawBase64.startsWith("data:")
            ? rawBase64.slice(5, rawBase64.indexOf(";base64,"))
            : "image/png",
        });
      } else if (Array.isArray(req.body.images || req.body.files)) {
        const list = req.body.images || req.body.files;
        for (const item of list) {
          if (typeof item === "string" && (isBase64DataUrl(item) || item.startsWith("data:image/"))) {
            const folderName = req.body.folder || "images";
            const relativeUrl = saveBase64Image(item, folderName);
            const filename = path.basename(relativeUrl);
            uploadedFiles.push({
              filename,
              relativeUrl,
              url: `${baseUrl}${relativeUrl}`,
              imageUrl: `${baseUrl}${relativeUrl}`,
              size: 0,
              mimetype: "image/png",
            });
          }
        }
      }
    }

    if (uploadedFiles.length === 0) {
      res.status(400).json({
        success: false,
        message:
          "No image provided. Please upload an image using multipart form-data (field name: 'image' or 'file') or JSON body ({ image: 'data:image/png;base64,...' })",
      });
      return;
    }

    const primaryFile = uploadedFiles[0];

    res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      url: primaryFile.url,
      imageUrl: primaryFile.imageUrl,
      relativeUrl: primaryFile.relativeUrl,
      path: primaryFile.relativeUrl,
      filename: primaryFile.filename,
      data: {
        url: primaryFile.url,
        imageUrl: primaryFile.imageUrl,
        relativeUrl: primaryFile.relativeUrl,
        path: primaryFile.relativeUrl,
        filename: primaryFile.filename,
        size: primaryFile.size,
        mimetype: primaryFile.mimetype,
      },
      files: uploadedFiles,
      count: uploadedFiles.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllImages = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const baseUrl = getBaseUrl(req);
    const queryFolder = (req.query.folder as string) || "images";
    const targetDir = path.join(process.cwd(), "uploads", queryFolder);

    if (!fs.existsSync(targetDir)) {
      res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        data: [],
      });
      return;
    }

    const fileNames = fs.readdirSync(targetDir);
    const images = fileNames
      .filter((file) => !file.startsWith("."))
      .map((fileName) => {
        const filePath = path.join(targetDir, fileName);
        const stats = fs.statSync(filePath);
        const relativeUrl = `/uploads/${queryFolder}/${fileName}`;
        return {
          filename: fileName,
          relativeUrl,
          url: `${baseUrl}${relativeUrl}`,
          imageUrl: `${baseUrl}${relativeUrl}`,
          size: stats.size,
          createdAt: stats.birthtime,
          updatedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 50);
    const skip = (page - 1) * limit;
    const paginatedImages = images.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      count: paginatedImages.length,
      total: images.length,
      data: paginatedImages,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(images.length / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getImageByName = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!filename || typeof filename !== "string") {
      res.status(400).json({ success: false, message: "Filename is required" });
      return;
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "Image not found" });
      return;
    }

    const stats = fs.statSync(filePath);
    const baseUrl = getBaseUrl(req);
    const relativeUrl = `/uploads/images/${safeFilename}`;

    res.status(200).json({
      success: true,
      data: {
        filename: safeFilename,
        relativeUrl,
        url: `${baseUrl}${relativeUrl}`,
        imageUrl: `${baseUrl}${relativeUrl}`,
        size: stats.size,
        createdAt: stats.birthtime,
        updatedAt: stats.mtime,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteImageByName = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const rawFilename = req.params.filename;
    const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
    if (!filename || typeof filename !== "string") {
      res.status(400).json({ success: false, message: "Filename is required" });
      return;
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "Image not found" });
      return;
    }

    fs.unlinkSync(filePath);

    res.status(200).json({
      success: true,
      message: `Image ${safeFilename} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
