import auth, { AuthRequest } from "../middleware/auth.js";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../utils/db.js";
import rateLimit from "express-rate-limit";

// Rate limiter for login attempts (brute force protection)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes per IP
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Debug test route
router.get("/testsignup", (req, res) => res.send("Auth test works"));

router.post("/signup", async (req, res) => {
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

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already exists" });
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
      "SELECT id, name, email, password FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.json({
      token,
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
