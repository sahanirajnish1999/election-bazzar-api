import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import path from "path";
import { requestLogger } from "./requestLogger";
import { isOriginAllowed } from "./utils/corsHelper";

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
// TODO: Add your application routes here (e.g. app.use("/v1/api/...", ...Routes))

// Error Handling Middleware
app.use((err: any, req: any, res: any, _next: any) => {
  console.log("\n");
  console.log("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌");
  console.log("🔥 API ERROR");
  console.log("────────────────────────────────────────────");
  console.log(`📍 Route   : ${req.method} ${req.originalUrl}`);
  console.log(`📦 Status  : ${err.status || 500}`);
  console.log(`💥 Message : ${err.message}`);
  console.log(`📄 Stack`);
  console.error(err.stack);
  console.log("❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌\n");

  res.status(err.status || 500).json({
    success: false,
    Message: err.message || "Internal Server Error",
  });
});

export default app;
