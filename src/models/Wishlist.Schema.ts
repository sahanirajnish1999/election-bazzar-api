import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWishlistItem extends Document {
  userId: string;
  categoryId: Types.ObjectId;
  shapeId?: Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlistItem>(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category ID is required"],
      index: true,
    },
    shapeId: {
      type: Schema.Types.ObjectId,
      ref: "Shape",
      default: null,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index to guarantee uniqueness per user, category, and shape
WishlistSchema.index({ userId: 1, categoryId: 1, shapeId: 1 }, { unique: true });

export const Wishlist = mongoose.model<IWishlistItem>("Wishlist", WishlistSchema);
export default Wishlist;
