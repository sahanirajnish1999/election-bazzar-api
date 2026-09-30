import { Model, Types } from "mongoose";

export interface SlugOptions {
  lower?: boolean;

  separator?: string;

  strict?: boolean;

  maxLength?: number;
}

export interface UniqueSlugOptions extends SlugOptions {
  slugField?: string;

  excludeId?: string | Types.ObjectId;
}

export const createSlug = (text: string, options: SlugOptions = {}): string => {
  const { lower = true, separator = "-", strict = true, maxLength } = options;

  if (!text || typeof text !== "string") {
    return "";
  }

  let slug = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (lower) {
    slug = slug.toLowerCase();
  }

  if (strict) {
    // Replace non-alphanumeric characters with separator
    slug = slug.replace(/[^a-z0-9]+/gi, separator);
  } else {
    // Replace spaces and underscores with separator, keeping other unicode chars
    slug = slug.replace(/[\s_]+/g, separator);
  }

  // Escape special regex characters in separator for safe pattern matching
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const duplicateRegex = new RegExp(`${escapedSep}+`, "g");
  const trimRegex = new RegExp(`^${escapedSep}+|${escapedSep}+$`, "g");

  // Remove consecutive separators and trim leading/trailing separators
  slug = slug.replace(duplicateRegex, separator).replace(trimRegex, "");

  // Apply maximum length if specified
  if (maxLength && maxLength > 0 && slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(trimRegex, "");
  }

  return slug;
};

export const generateUniqueSlug = async <T>(
  model: Model<T>,
  text: string,
  options: UniqueSlugOptions = {},
): Promise<string> => {
  const {
    slugField = "slug",
    excludeId,
    separator = "-",
    ...slugOptions
  } = options;

  const baseSlug =
    createSlug(text, { ...slugOptions, separator }) || `${Date.now()}`;

  const escapedBaseSlug = baseSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`^${escapedBaseSlug}(${escapedSep}\\d+)?$`);

  const query: Record<string, any> = {
    [slugField]: { $regex: regex },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingDocs = await model
    .find(query, { [slugField]: 1 })
    .lean()
    .exec();

  if (!existingDocs || existingDocs.length === 0) {
    return baseSlug;
  }

  const existingSlugs = new Set(
    existingDocs
      .map((doc: any) => doc[slugField])
      .filter((s: unknown): s is string => typeof s === "string"),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  while (existingSlugs.has(`${baseSlug}${separator}${counter}`)) {
    counter++;
  }

  return `${baseSlug}${separator}${counter}`;
};

export class SlugService {
  public static create(text: string, options?: SlugOptions): string {
    return createSlug(text, options);
  }

  public static async createUnique<T>(
    model: Model<T>,
    text: string,
    options?: UniqueSlugOptions,
  ): Promise<string> {
    return generateUniqueSlug(model, text, options);
  }
}

export const slugService = {
  create: createSlug,
  createUnique: generateUniqueSlug,
};

export default SlugService;
