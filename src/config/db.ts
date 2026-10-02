import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not defined");
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error("[MongoDB] Primary connection error:", error);

    if (process.env.MONGO_URI && !process.env.MONGO_URI.includes("localhost")) {
      console.log("[MongoDB] Attempting fallback connection to local MongoDB...");
      try {
        const fallbackUri = "mongodb://localhost:27017/election_db";
        const conn = await mongoose.connect(fallbackUri);
        console.log(`[MongoDB] Connected successfully to local fallback DB: ${conn.connection.host}`);
        return;
      } catch (fallbackErr) {
        console.error("[MongoDB] Fallback connection failed:", fallbackErr);
      }
    }

    process.exit(1);
  }
};
