import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import pool from "../../utils/db.js";
import { adminAuth, AdminRequest } from "../middleware/adminAuth.js";
import { createAuditLog } from "../services/auditService.js";

const router = Router();

// Rate limiting for admin login
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

// POST /admin/auth/login
router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(
      `SELECT id, email, password, name, role, is_active FROM admin_users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const admin = result.rows[0];

    if (!admin.is_active) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await pool.query(
      `UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`,
      [admin.id]
    );

    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role, type: "admin" },
      secret,
      { expiresIn: "8h" }
    );

    // Log the login
    await createAuditLog({
      adminId: admin.id,
      action: "admin.login",
      entityType: "admin",
      entityId: admin.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /admin/auth/me
router.get("/me", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, email, name, role, last_login_at, created_at
       FROM admin_users WHERE id = $1`,
      [req.adminId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json({ admin: result.rows[0] });
  } catch (err) {
    console.error("Get admin error:", err);
    res.status(500).json({ error: "Failed to get admin info" });
  }
});

// POST /admin/auth/change-password
router.post(
  "/change-password",
  adminAuth,
  async (req: AdminRequest, res: Response) => {
    try {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Old and new passwords are required" });
      }

      if (newPassword.length < 8) {
        return res
          .status(400)
          .json({ error: "New password must be at least 8 characters" });
      }

      const result = await pool.query(
        `SELECT password FROM admin_users WHERE id = $1`,
        [req.adminId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Admin not found" });
      }

      const validPassword = await bcrypt.compare(
        oldPassword,
        result.rows[0].password
      );
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid current password" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        `UPDATE admin_users SET password = $1, updated_at = NOW() WHERE id = $2`,
        [hashedPassword, req.adminId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "admin.password_change",
        entityType: "admin",
        entityId: req.adminId,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

export default router;
