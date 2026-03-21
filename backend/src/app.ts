import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import authRoutes from "./routes/auth";
import productRoutes from "./routes/products.js";
import variantRoutes from "./routes/variants.js";
import deliveryRoutes from "./routes/delivery.js";
import aiRoutes from "./routes/ai.js";
import pool from "./utils/db.js";
import paymentRoutes from "./routes/payment.js";
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

//auth routes



export default app;
