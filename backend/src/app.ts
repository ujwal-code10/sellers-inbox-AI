import "dotenv/config";
import express from "express";
import cors from "cors";

// Validate required environment variables at startup
const requiredEnvVars = ['JWT_SECRET', 'GROQ_API_KEY', 'DATABASE_URL'];
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

// Warn if eSewa secret is missing (payment will fail but app can start)
if (!process.env.ESEWA_SECRET_KEY && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: ESEWA_SECRET_KEY not set. Payments will fail.');
}

// Admin JWT Secret warning
if (!process.env.ADMIN_JWT_SECRET) {
  console.warn('WARNING: ADMIN_JWT_SECRET not set. Using JWT_SECRET as fallback for admin auth.');
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
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api", variantRoutes);
app.use("/api", deliveryRoutes);
app.use("/api", aiRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Debug endpoint - shows env var status and DB connection on Vercel
app.get("/api/debug", async (_req, res) => {
  const envStatus = {
    DATABASE_URL: process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.substring(0, 30) + "...)" : "NOT SET",
    GROQ_API_KEY: process.env.GROQ_API_KEY ? "SET" : "NOT SET",
    JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
    VERCEL: process.env.VERCEL || "NOT SET",
    NODE_ENV: process.env.NODE_ENV || "NOT SET",
  };

  let dbStatus = "untested";
  try {
    const result = await pool.query("SELECT NOW() as time");
    dbStatus = "connected - " + result.rows[0].time;
  } catch (err: any) {
    dbStatus = "FAILED - " + err.message;
  }

  res.json({ envStatus, dbStatus });
});


//test route
app.get("/test", (req, res) => res.send("Test route works!"));


// Root route
app.get("/", (_req, res) => {
  res.send("API running");
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Admin initialization status endpoint (for debugging)
app.get("/api/admin/init-status", async (_req, res) => {
  try {
    const status = await getInitStatus();
    res.json({ status: "ok", ...status });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

//auth routes



export default app;
