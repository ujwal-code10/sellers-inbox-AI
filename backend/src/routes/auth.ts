import auth, { AuthRequest } from "../middleware/auth.js";
import express from "express";
import bcrypt from "bcryptjs";
import pool from "../utils/db.js";
import rateLimit from "express-rate-limit";
import {
  COOKIE_NAMES,
  SELLER_REFRESH_TTL_SECONDS,
  clearCsrfCookie,
  clearSellerAuthCookies,
  createRefreshSession,
  isSafeMethod,
  issueCsrfCookie,
  revokeRefreshSession,
  rotateRefreshSession,
  setSellerAuthCookies,
  signSellerAccessToken,
  validateCsrfForCookieRequest,
} from "../utils/authSession.js";

// Rate limiter for login attempts (brute force protection)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
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
  windowMs: 15 * 60 * 1000, // 15 minutes
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

// Debug test route
if (process.env.NODE_ENV !== "production") {
  router.get("/testsignup", (_req, res) => res.send("Auth test works"));
}

router.post("/signup", signupRateLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  // Validate name
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: "Name must be 1-100 characters" });
  }

  // Validate email format and length
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 255) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  // Validate password length
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  if (password.length > 128) {
    return res.status(400).json({ error: "Password is too long (max 128 characters)" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

    const accessToken = signSellerAccessToken(user.id);
    const refreshSession = await createRefreshSession({
      tokenType: "user",
      userId: user.id,
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    setSellerAuthCookies(res, accessToken, refreshSession.token);
    issueCsrfCookie(res);

    res.status(201).json({ user });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Unable to create account" });
    }
    console.error("Signup error:", err);
    // CRITICAL: Don't expose internal error details to client
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, name, email, password, banned_at, ban_reason FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check if user is banned
    if (user.banned_at) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const accessToken = signSellerAccessToken(user.id);
    const refreshSession = await createRefreshSession({
      tokenType: "user",
      userId: user.id,
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    setSellerAuthCookies(res, accessToken, refreshSession.token);
    issueCsrfCookie(res);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }); 
  } catch (err: any) {
    console.error("Login error:", err);
    // CRITICAL: Don't expose internal error details to client
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-password", forgotPasswordRateLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    // Query intentionally does not change response payload to avoid account enumeration.
    await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [
      normalizedEmail,
    ]);

    return res.json({
      message:
        "If an account exists for this email, reset instructions will be sent shortly.",
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/refresh", refreshRateLimiter, async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAMES.sellerRefresh];

  if (!refreshToken || typeof refreshToken !== "string") {
    clearSellerAuthCookies(res);
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const rotated = await rotateRefreshSession({
      currentToken: refreshToken,
      tokenType: "user",
      ttlSeconds: SELLER_REFRESH_TTL_SECONDS,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    if (!rotated?.userId) {
      clearSellerAuthCookies(res);
      clearCsrfCookie(res);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const accessToken = signSellerAccessToken(rotated.userId);
    setSellerAuthCookies(res, accessToken, rotated.token);
    issueCsrfCookie(res);

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Refresh session error:", err);
    clearSellerAuthCookies(res);
    clearCsrfCookie(res);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const hasSessionCookie = Boolean(
    req.cookies?.[COOKIE_NAMES.sellerAccess] ||
      req.cookies?.[COOKIE_NAMES.sellerRefresh]
  );

  if (
    hasSessionCookie &&
    !isSafeMethod(req.method) &&
    !validateCsrfForCookieRequest(req)
  ) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const refreshToken = req.cookies?.[COOKIE_NAMES.sellerRefresh];

  try {
    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      await revokeRefreshSession(refreshToken, "user");
    }
  } catch (err) {
    console.error("Logout revoke session error:", err);
  }

  clearSellerAuthCookies(res);
  clearCsrfCookie(res);

  return res.json({ message: "Logged out" });
});

router.get("/me", auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error("Me error:", err);
    // CRITICAL: Don't expose internal error details to client
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/me", auth, async (req: AuthRequest, res) => {
  const { name } = req.body;

  if (typeof name !== "string") {
    return res.status(400).json({ error: "Name is required" });
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0 || trimmedName.length > 100) {
    return res.status(400).json({ error: "Name must be 1-100 characters" });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
      [trimmedName, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: result.rows[0] });
  } catch (err: any) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});



export default router;
