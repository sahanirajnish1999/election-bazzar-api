import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  mobile: string;
  email?: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    mobile: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // MongoDB TTL index: automatically deletes document 10 minutes after creation
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const Otp = mongoose.model<IOtp>("Otp", OtpSchema);
export default Otp;
