import mongoose, { Document, Schema, Types } from "mongoose";

export interface IFeature extends Document {
  shapeId: Types.ObjectId;
  categoryId: Types.ObjectId;
  colors?: string[];
  materialTypes?: string[];
  sizes?: string[];
  thicknesses?: string[];
  numberOfPages?: string[];
  matteOptions?: string[];
  capacities?: string[];
  tShirtSizes?: string[];
  displayLayouts?: any[];
  description?: string;
  status: "active" | "inactive";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureSchema = new Schema<IFeature>(
  {
    shapeId: {
      type: Schema.Types.ObjectId,
      ref: "Shape",
      required: [true, "Shape ID is required"],
      unique: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category ID is required"],
      index: true,
    },
    colors: {
      type: [String],
    },
    materialTypes: {
      type: [String],
    },
    sizes: {
      type: [String],
    },
    thicknesses: {
      type: [String],
    },
    numberOfPages: {
      type: [String],
    },
    matteOptions: {
      type: [String],
    },
    capacities: {
      type: [String],
    },
    tShirtSizes: {
      type: [String],
    },
    displayLayouts: {
      type: [Schema.Types.Mixed],
    },
    description: {
      type: String,
      trim: true,
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
    toJSON: {
      transform: (_doc, ret: any) => {
        const optionKeys = [
          "colors",
          "materialTypes",
          "sizes",
          "thicknesses",
          "numberOfPages",
          "matteOptions",
          "capacities",
          "tShirtSizes",
          "displayLayouts",
        ];
        for (const key of optionKeys) {
          if (!ret[key] || (Array.isArray(ret[key]) && ret[key].length === 0)) {
            delete ret[key];
          }
        }
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        const optionKeys = [
          "colors",
          "materialTypes",
          "sizes",
          "thicknesses",
          "numberOfPages",
          "matteOptions",
          "capacities",
          "tShirtSizes",
          "displayLayouts",
        ];
        for (const key of optionKeys) {
          if (!ret[key] || (Array.isArray(ret[key]) && ret[key].length === 0)) {
            delete ret[key];
          }
        }
        return ret;
      },
    },
  },
);

export const Feature = mongoose.model<IFeature>("Feature", FeatureSchema);

// Safely drop legacy unique index on categoryId if it exists
Feature.collection?.dropIndex("categoryId_1").catch(() => {});

export default Feature;
