import mongoose, { Document, Schema, Types } from "mongoose";

export interface IOrderItem {
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
}

export interface IShippingAddress {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  zipCode?: string;
  country?: string;
}

export interface IPaymentDetails {
  paymentMethod?: string;
  paymentStatus?: "pending" | "completed" | "failed" | "refunded";
  transactionId?: string;
  paidAt?: Date;
}

export interface IOrder extends Document {
  orderId: string;
  userId?: string;
  sessionId?: string;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentDetails: IPaymentDetails;
  subtotal: number;
  tax: number;
  shippingFee: number;
  totalAmount: number;
  orderStatus: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    itemName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 1, min: 1 },
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
  { _id: true, timestamps: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, trim: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

const PaymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    paymentMethod: { type: String, default: "COD", trim: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [
        (val: IOrderItem[]) => val.length > 0,
        "Order must contain at least one item",
      ],
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      default: {},
    },
    paymentDetails: {
      type: PaymentDetailsSchema,
      default: () => ({ paymentMethod: "COD", paymentStatus: "pending" }),
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
