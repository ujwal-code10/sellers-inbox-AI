import express from "express";
import auth from "../middleware/auth.js";
import { checkProductLimit } from "../middleware/checkPlan.js";
import {
  createProductHandler,
  deleteProductHandler,
  listProductsHandler,
  updateProductHandler,
} from "../controllers/productController.js";

const router = express.Router();

// SOURCE: product CRUD is driven by authenticated seller dashboard actions.
// RISK: missing ownership or plan gating here can allow unauthorized writes or quota bypass.
// PROTECTION: require auth on all product routes and enforce free-tier product cap on create.
// RESULT: product data stays tenant-scoped and aligned with subscription limits.
router.post("/", auth, checkProductLimit, createProductHandler);
router.get("/", auth, listProductsHandler);
router.patch("/:id", auth, updateProductHandler);
router.delete("/:id", auth, deleteProductHandler);

export default router;