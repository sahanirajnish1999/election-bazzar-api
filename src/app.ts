import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import path from "path";
import { requestLogger } from "./requestLogger";
import { isOriginAllowed } from "./utils/corsHelper";

import categoryRoutes from "./routes/categoryRoutes";
import shapeRoutes from "./routes/shapeRoutes";
import adminRoutes from "./routes/adminRoutes";
import featureRoutes from "./routes/featureRoutes";
import priceRoutes from "./routes/priceRoutes";
import detailRoutes from "./routes/detailRoutes";

const app = express();

app.use(requestLogger);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API Routes
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/shapes", shapeRoutes);
app.use("/api/v1/features", featureRoutes);
app.use("/api/v1/prices", priceRoutes);
app.use("/api/v1/details", detailRoutes);

app.use((err: any, req: any, res: any, _next: any) => {
  const statusCode = err.status || 500;
  console.log("\n");
  console.log("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌");
  console.log("🔥 API ERROR");
  console.log("────────────────────────────────────────────");
  console.log(`📍 Route   : ${req.method} ${req.originalUrl}`);
  console.log(`📦 Status  : ${statusCode}`);
  console.log(`💥 Message : ${err.message}`);
  console.log(`📄 Stack`);
  console.error(err.stack);
  console.log("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌\n");

  res.status(statusCode).json({
    success: false,
    message: err.message,
  });
});

export default app;
