import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products.js";
import variantRoutes from "./routes/variants.js";
import deliveryRoutes from "./routes/delivery.js";
import aiRoutes from "./routes/ai.js";


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api", variantRoutes);
app.use("/api", deliveryRoutes);
app.use("/api", aiRoutes);


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
