import express from "express";
import auth from "../middleware/auth.js";
import {
  createDeliveryZoneHandler,
  deleteDeliveryZoneHandler,
  listDeliveryZonesHandler,
  updateDeliveryZoneHandler,
} from "../controllers/deliveryController.js";

const router = express.Router();

router.post("/delivery-zones", auth, createDeliveryZoneHandler);
router.get("/delivery-zones", auth, listDeliveryZonesHandler);
router.patch("/delivery-zones/:id", auth, updateDeliveryZoneHandler);
router.delete("/delivery-zones/:id", auth, deleteDeliveryZoneHandler);

export default router;