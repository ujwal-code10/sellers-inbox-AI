import express from "express";
import auth from "../middleware/auth.js";
import {
  createProductVariantsBulkHandler,
  createProductVariantHandler,
  listProductVariantsHandler,
  updateVariantAvailabilityHandler,
} from "../controllers/variantController.js";

const router = express.Router();

router.get("/products/:productId/variants", auth, listProductVariantsHandler);
router.post("/products/:productId/variants", auth, createProductVariantHandler);
router.post(
  "/products/:productId/variants/bulk",
  auth,
  createProductVariantsBulkHandler
);
router.patch("/variants/:variantId", auth, updateVariantAvailabilityHandler);

export default router;