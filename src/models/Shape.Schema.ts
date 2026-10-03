import mongoose, { Document, Schema, Types } from "mongoose";

export interface IShape extends Document {
  name: string;
  slug: string;
  categoryId: Types.ObjectId;
  description?: string;
  image?: string | null;
  status: "active" | "inactive";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ShapeSchema = new Schema<IShape>(
  {
    name: {
      type: String,
      required: [true, "Shape name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Shape slug is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category ID is required"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ShapeSchema.index({ categoryId: 1, slug: 1 }, { unique: true });

export const Shape = mongoose.model<IShape>("Shape", ShapeSchema);

// Safely drop legacy unique index on slug if it exists
Shape.collection?.dropIndex("slug_1").catch(() => {});

export default Shape;
