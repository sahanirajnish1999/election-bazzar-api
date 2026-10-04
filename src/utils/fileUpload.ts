import fs from "fs";
import path from "path";

export const isBase64DataUrl = (str: any): boolean => {
  return typeof str === "string" && str.startsWith("data:") && str.includes(";base64,");
};

export const saveBase64Image = (
  base64String: string,
  folderName = "misc",
  customFileName: string | null = null,
): string => {
  if (!base64String) {
    throw new Error("Base64 string is required");
  }

  let extension = "png";
  let base64Data = base64String;

  if (base64String.startsWith("data:")) {
    const base64Index = base64String.indexOf(";base64,");
    if (base64Index !== -1) {
      const mimeType = base64String.slice(5, base64Index);
      base64Data = base64String.slice(base64Index + 8);

      const mimeToExt: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg",
        "application/pdf": "pdf",
      };

      extension = mimeToExt[mimeType] || mimeType.split("/")[1] || "png";
    }
  }

  const uploadDir = path.join(process.cwd(), "uploads", folderName);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = customFileName
    ? customFileName.endsWith(`.${extension}`)
      ? customFileName
      : `${customFileName}.${extension}`
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;

  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${folderName}/${fileName}`;
};

export const saveIfBase64 = (
  value: any,
  folderName = "cart"
): any => {
  if (typeof value !== "string") return value;
  if (isBase64DataUrl(value)) {
    try {
      return saveBase64Image(value, folderName);
    } catch (e: any) {
      console.error("Failed to save base64 image:", e.message);
      return value;
    }
  }
  return value;
};

export const sanitizeImages = (data: any, folderName = "cart"): any => {
  if (!data) return data;
  if (typeof data === "string") {
    return saveIfBase64(data, folderName);
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeImages(item, folderName));
  }
  if (typeof data === "object" && data.constructor === Object) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      sanitized[key] = sanitizeImages(data[key], folderName);
    }
    return sanitized;
  }
  return data;
};

export const deleteImage = (imageUrl: string): void => {
  if (!imageUrl) return;
  try {
    const relativePath = imageUrl.startsWith("/")
      ? imageUrl.slice(1)
      : imageUrl;
    const filePath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err: any) {
    console.error("Error deleting image:", err.message);
  }
};

