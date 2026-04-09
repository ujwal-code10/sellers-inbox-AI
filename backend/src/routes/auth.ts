import auth from "../middleware/auth.js";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  signupHandler,
  updateMeHandler,
} from "../controllers/authController.js";

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many signup attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many reset requests. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many refresh attempts. Please try again shortly." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

const debugRoutesEnabled =
  process.env.ENABLE_DEBUG_ROUTES === "true" &&
  process.env.NODE_ENV !== "production";

if (debugRoutesEnabled) {
  router.get("/testsignup", (_req, res) => res.send("Auth test works"));
}

router.post("/signup", signupRateLimiter, signupHandler);
router.post("/login", loginRateLimiter, loginHandler);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPasswordHandler);
router.post("/refresh", refreshRateLimiter, refreshHandler);
router.post("/logout", logoutHandler);

router.get("/me", auth, meHandler);
router.patch("/me", auth, updateMeHandler);

export default router;
