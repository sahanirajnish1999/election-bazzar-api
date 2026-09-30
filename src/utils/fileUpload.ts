import fs from "fs";
import path from "path";

export const saveBase64Image = (
  base64String: string,
  folderName = "misc",
  customFileName: string | null = null,
): string => {
  if (!base64String) {
    throw new Error("Base64 string is required");
  }

  let mimeType = "image/png";
  let extension = "png";
  let base64Data = base64String;

  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    mimeType = matches[1];
    base64Data = matches[2];

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
