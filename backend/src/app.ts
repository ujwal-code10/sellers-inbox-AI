import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { installProductionConsoleSafety } from "./utils/logger.js";

installProductionConsoleSafety();

// Validate required environment variables at startup
const requiredEnvVars = ["JWT_SECRET", "ADMIN_JWT_SECRET", "GROQ_API_KEY", "DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`FATAL ERROR: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set these in your .env file or environment configuration');
  process.exit(1);
}

// Validate JWT_SECRET length (security requirement)
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('FATAL ERROR: JWT_SECRET must be at least 32 characters long');
  process.exit(1);
}

if (process.env.ADMIN_JWT_SECRET && process.env.ADMIN_JWT_SECRET.length < 32) {
  console.error("FATAL ERROR: ADMIN_JWT_SECRET must be at least 32 characters long");
  process.exit(1);
}

// Warn if eSewa secret is missing (payment will fail but app can start)
if (process.env.NODE_ENV === 'production') {
  if (!process.env.ESEWA_SECRET_KEY || !process.env.ESEWA_MERCHANT_CODE) {
    console.warn('WARNING: ESEWA_SECRET_KEY or ESEWA_MERCHANT_CODE not set. eSewa payments will be disabled.');
  }
}

const debugRoutesEnabled =
  process.env.ENABLE_DEBUG_ROUTES === "true" &&
  process.env.NODE_ENV !== "production";

if (process.env.ENABLE_DEBUG_ROUTES === "true" && process.env.NODE_ENV === "production") {
  console.warn("ENABLE_DEBUG_ROUTES is ignored in production.");
}

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products.js";
import variantRoutes from "./routes/variants.js";
import deliveryRoutes from "./routes/delivery.js";
import aiRoutes from "./routes/ai.js";
import pool from "./utils/db.js";
import paymentRoutes from "./routes/payment.js";
import adminRoutes from "./admin/index.js";
import { getInitStatus } from "./utils/init.js";

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const addOrigin = (rawValue?: string) => {
    if (!rawValue) return;
    try {
      const normalized = new URL(rawValue).origin;
      origins.add(normalized);
    } catch {
      console.warn(`Ignoring invalid CORS origin value: ${rawValue}`);
    }
  };

  addOrigin(process.env.FRONTEND_URL);

  if (process.env.CORS_ORIGINS) {
    for (const rawOrigin of process.env.CORS_ORIGINS.split(",")) {
      addOrigin(rawOrigin.trim());
    }
  }

  if (process.env.NODE_ENV !== "production") {
    ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"].forEach(addOrigin);
  }

  return origins;
}

const allowedOrigins = getAllowedOrigins();

if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) {
  console.error("FATAL ERROR: No allowed CORS origins configured. Set FRONTEND_URL or CORS_ORIGINS.");
  process.exit(1);
}

const app = express();

// Middleware
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api", variantRoutes);
app.use("/api", deliveryRoutes);
app.use("/api", aiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

if (debugRoutesEnabled) {
  // Debug endpoint for local development only
  app.get("/api/debug", async (_req, res) => {
    const envStatus = {
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
      GROQ_API_KEY: process.env.GROQ_API_KEY ? "SET" : "NOT SET",
      JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET ? "SET" : "NOT SET",
      VERCEL: process.env.VERCEL || "NOT SET",
      NODE_ENV: process.env.NODE_ENV || "NOT SET",
    };

    let dbStatus = "untested";
    try {
      const result = await pool.query("SELECT NOW() as time");
      dbStatus = "connected - " + result.rows[0].time;
    } catch {
      dbStatus = "FAILED";
    }

    res.json({ envStatus, dbStatus });
  });

  // Local-only test route
  app.get("/test", (_req, res) => res.send("Test route works!"));

  // Local-only admin initialization status endpoint
  app.get("/api/admin/init-status", async (_req, res) => {
    try {
      const status = await getInitStatus();
      res.json({ status: "ok", ...status });
    } catch {
      res.status(500).json({ status: "error" });
    }
  });
}


// Root route
app.get("/", (_req, res) => {
  res.send("API running");
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
