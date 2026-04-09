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

router.post("/", auth, checkProductLimit, createProductHandler);
router.get("/", auth, listProductsHandler);
router.patch("/:id", auth, updateProductHandler);
router.delete("/:id", auth, deleteProductHandler);

export default router;