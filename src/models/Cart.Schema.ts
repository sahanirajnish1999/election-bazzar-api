import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICartItem {
  _id?: Types.ObjectId;
  itemName: string;
  price: number;
  quantity: number;
  dimensions?: string;
  size?: string;
  surface?: string;
  finishing?: string;
  wrapStyle?: string;
  color?: string;
  borderWidth?: string;
  chooseFormat?: string;
  shape?: string;
  mattingStyle?: string;
  image?: string;
  allImages?: string[];
  designState?: Record<string, any>;
  specifications?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICart extends Document {
  userId?: string;
  sessionId?: string;
  items: ICartItem[];
  totalPrice: number;
  totalQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Item price is required"],
      min: [0, "Price cannot be negative"],
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, "Quantity must be at least 1"],
    },
    dimensions: { type: String, trim: true },
    size: { type: String, trim: true },
    surface: { type: String, trim: true },
    finishing: { type: String, trim: true },
    wrapStyle: { type: String, trim: true },
    color: { type: String, trim: true },
    borderWidth: { type: String, trim: true },
    chooseFormat: { type: String, trim: true },
    shape: { type: String, trim: true },
    mattingStyle: { type: String, trim: true },
    image: { type: String, default: null },
    allImages: [{ type: String }],
    designState: { type: Schema.Types.Mixed, default: {} },
    specifications: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: String,
      index: true,
      default: null,
    },
    sessionId: {
      type: String,
      index: true,
      default: null,
    },
    items: [CartItemSchema],
    totalPrice: {
      type: Number,
      default: 0,
    },
    totalQuantity: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Recalculate totals before saving
CartSchema.pre("save", function () {
  if (this.items && Array.isArray(this.items)) {
    this.totalQuantity = this.items.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );
    this.totalPrice = Number(
      this.items
        .reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
        .toFixed(2)
    );
  } else {
    this.totalQuantity = 0;
    this.totalPrice = 0;
  }
});

export const Cart = mongoose.model<ICart>("Cart", CartSchema);
export default Cart;
