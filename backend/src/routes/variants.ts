import express from "express";
import auth from "../middleware/auth.js";
import {
  createProductVariantsBulkHandler,
  createProductVariantHandler,
  listProductVariantsHandler,
  updateVariantAvailabilityHandler,
} from "../controllers/variantController.js";

const router = express.Router();

// SOURCE: variant operations are triggered from seller product setup and stock toggles.
// RISK: unauthenticated or cross-tenant variant writes can corrupt catalog integrity.
// PROTECTION: enforce auth middleware on every variant route before controller/service logic.
// RESULT: variant listing and updates remain restricted to valid seller context.
router.get("/products/:productId/variants", auth, listProductVariantsHandler);
router.post("/products/:productId/variants", auth, createProductVariantHandler);
router.post(
  "/products/:productId/variants/bulk",
  auth,
  createProductVariantsBulkHandler
);
router.patch("/variants/:variantId", auth, updateVariantAvailabilityHandler);

export default router;