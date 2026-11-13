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
  frame?: string;
  frameFinish?: string;
  wrapStyle?: string;
  color?: string;
  borderWidth?: string;
  chooseFormat?: string;
  shape?: string;
  mattingStyle?: string;
  hardware?: string;
  hangingHardware?: string;
  backingMaterial?: string;
  displayOption?: string;
  photoFilter?: string;
  lamination?: string;
  retouchServices?: string;
  majorRetouchNotes?: string;
  isProofRequested?: boolean;
  image?: string;
  previewImage?: string;
  allImages?: string[];
  textLayers?: any[];
  clipartLayers?: any[];
  designState?: Record<string, any>;
  state?: Record<string, any>;
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
    frame: { type: String, trim: true },
    frameFinish: { type: String, trim: true },
    wrapStyle: { type: String, trim: true },
    color: { type: String, trim: true },
    borderWidth: { type: String, trim: true },
    chooseFormat: { type: String, trim: true },
    shape: { type: String, trim: true },
    mattingStyle: { type: String, trim: true },
    hardware: { type: String, trim: true },
    hangingHardware: { type: String, trim: true },
    backingMaterial: { type: String, trim: true },
    displayOption: { type: String, trim: true },
    photoFilter: { type: String, trim: true },
    lamination: { type: String, trim: true },
    retouchServices: { type: String, trim: true },
    majorRetouchNotes: { type: String, trim: true },
    isProofRequested: { type: Boolean, default: false },
    image: { type: String, default: null },
    previewImage: { type: String, default: null },
    allImages: [{ type: String }],
    textLayers: { type: Schema.Types.Mixed, default: [] },
    clipartLayers: { type: Schema.Types.Mixed, default: [] },
    designState: { type: Schema.Types.Mixed, default: {} },
    state: { type: Schema.Types.Mixed, default: {} },
    specifications: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: false }
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
