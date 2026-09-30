import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPrice extends Document {
  shapeId: Types.ObjectId;
  categoryId: Types.ObjectId;
  price: number;
  mrp?: number | null;
  status: "active" | "inactive";
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PriceSchema = new Schema<IPrice>(
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
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"],
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

export const Price = mongoose.model<IPrice>("Price", PriceSchema);
export default Price;
