import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `[Server] Running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
      );
      console.log(`[Server] Local URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("[Server] Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
