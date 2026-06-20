import express from "express";
import auth from "../middleware/auth.js";
import {
  createDeliveryZoneHandler,
  deleteDeliveryZoneHandler,
  listDeliveryZonesHandler,
  updateDeliveryZoneHandler,
} from "../controllers/deliveryController.js";

const router = express.Router();

// SOURCE: delivery zone configuration comes from authenticated seller setup screens.
// RISK: cross-user zone mutations can break shipping quotes and COD rules.
// PROTECTION: require auth on all delivery zone create/read/update/delete endpoints.
// RESULT: delivery pricing data remains isolated per seller account.
router.post("/delivery-zones", auth, createDeliveryZoneHandler);
router.get("/delivery-zones", auth, listDeliveryZonesHandler);
router.patch("/delivery-zones/:id", auth, updateDeliveryZoneHandler);
router.delete("/delivery-zones/:id", auth, deleteDeliveryZoneHandler);

export default router;