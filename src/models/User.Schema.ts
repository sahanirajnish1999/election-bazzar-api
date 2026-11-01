import mongoose, { Document, Schema } from "mongoose";

export interface IUserAddress {
  fullName?: string;
  phone?: string;
  streetAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  isDefault?: boolean;
}

export interface IUser extends Document {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile: string;
  profileImage?: string;
  isVerified: boolean;
  role: "user" | "admin" | "superadmin";
  addresses: IUserAddress[];
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IUserAddress>(
  {
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    streetAddress: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, trim: true, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Studio Member",
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      default: "",
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      index: true,
      trim: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    addresses: {
      type: [AddressSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const User = mongoose.model<IUser>("User", UserSchema);
export default User;
