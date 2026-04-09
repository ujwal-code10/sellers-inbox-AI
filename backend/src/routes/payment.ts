import express from "express";
import rateLimit from "express-rate-limit";
import auth from "../middleware/auth.js";
import {
  getManualQrConfigHandler,
  getManualQrStatusHandler,
  getPlansHandler,
  initiateEsewaHandler,
  submitManualQrHandler,
  verifyEsewaHandler,
} from "../controllers/paymentController.js";

const router = express.Router();

const manualQrSubmitRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: {
    error:
      "Too many manual payment submissions. Please wait a few minutes and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const esewaVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    error: "Too many payment verification requests. Please try again shortly.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/plans", auth, getPlansHandler);
router.get("/manual-qr/config", auth, getManualQrConfigHandler);
router.get("/manual-qr/status", auth, getManualQrStatusHandler);

router.post("/manual-qr/submit", manualQrSubmitRateLimiter, auth, submitManualQrHandler);

router.post("/esewa/initiate", auth, initiateEsewaHandler);
router.post("/esewa/verify", esewaVerifyRateLimiter, verifyEsewaHandler);

export default router;
