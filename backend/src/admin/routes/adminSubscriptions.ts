import { Router, Response } from "express";
import pool from "../../utils/db.js";
import {
  adminAuth,
  requireSuperAdmin,
  AdminRequest,
} from "../middleware/adminAuth.js";
import { createAuditLog } from "../services/auditService.js";

const router = Router();

// GET /admin/subscriptions - List all subscriptions
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", plan, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (plan) {
      conditions.push(`s.plan = $${paramIndex++}`);
      values.push(plan);
    }
    if (status) {
      conditions.push(`s.status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM subscriptions s ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated subscriptions
    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT
         s.*,
         u.name as user_name, u.email as user_email
       FROM subscriptions s
       LEFT JOIN users u ON s.user_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("List subscriptions error:", err);
    res.status(500).json({ error: "Failed to list subscriptions" });
  }
});

// PATCH /admin/subscriptions/:userId - Update subscription
router.patch(
  "/:userId",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.userId), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { plan, billing, status, expires_at, reason } = req.body;

      // Get current subscription
      const currentResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      const oldValue = currentResult.rows[0] || null;

      if (currentResult.rows.length === 0) {
        // Create subscription if it doesn't exist
        await pool.query(
          `INSERT INTO subscriptions (user_id, plan, billing, status, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            plan || "free",
            billing || "monthly",
            status || "active",
            expires_at || null,
          ]
        );
      } else {
        // Update existing subscription
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (plan !== undefined) {
          updates.push(`plan = $${paramIndex++}`);
          values.push(plan);
        }
        if (billing !== undefined) {
          updates.push(`billing = $${paramIndex++}`);
          values.push(billing);
        }
        if (status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          values.push(status);
        }
        if (expires_at !== undefined) {
          updates.push(`expires_at = $${paramIndex++}`);
          values.push(expires_at);
        }

        if (updates.length > 0) {
          values.push(userId);
          await pool.query(
            `UPDATE subscriptions SET ${updates.join(", ")} WHERE user_id = $${paramIndex}`,
            values
          );
        }
      }

      // Get updated subscription
      const newResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "subscription.update",
        entityType: "subscription",
        entityId: userId,
        oldValue,
        newValue: { ...newResult.rows[0], reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ subscription: newResult.rows[0] });
    } catch (err) {
      console.error("Update subscription error:", err);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  }
);

// POST /admin/subscriptions/:userId/grant-pro - Grant Pro access
router.post(
  "/:userId/grant-pro",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.userId), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { duration = "1 month", reason } = req.body;

      // Check if user exists
      const userCheck = await pool.query(`SELECT id FROM users WHERE id = $1`, [
        userId,
      ]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Calculate expiry based on duration
      let expiresAt: Date;
      const now = new Date();
      if (duration === "1 week") {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (duration === "1 month") {
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
      } else if (duration === "3 months") {
        expiresAt = new Date(now.setMonth(now.getMonth() + 3));
      } else if (duration === "1 year") {
        expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
      } else {
        expiresAt = new Date(now.setMonth(now.getMonth() + 1));
      }

      // Get current subscription
      const currentResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );
      const oldValue = currentResult.rows[0] || null;

      // Upsert subscription
      await pool.query(
        `INSERT INTO subscriptions (user_id, plan, billing, status, started_at, expires_at)
         VALUES ($1, 'pro', 'monthly', 'active', NOW(), $2)
         ON CONFLICT (user_id)
         DO UPDATE SET plan = 'pro', status = 'active', started_at = NOW(), expires_at = $2`,
        [userId, expiresAt]
      );

      const newResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "subscription.grant_pro",
        entityType: "subscription",
        entityId: userId,
        oldValue,
        newValue: { ...newResult.rows[0], duration, reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: "Pro access granted",
        subscription: newResult.rows[0],
      });
    } catch (err) {
      console.error("Grant Pro error:", err);
      res.status(500).json({ error: "Failed to grant Pro access" });
    }
  }
);

// POST /admin/subscriptions/:userId/revoke-pro - Revoke Pro access
router.post(
  "/:userId/revoke-pro",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.userId), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { reason } = req.body;

      // Get current subscription
      const currentResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const oldValue = currentResult.rows[0];

      // Revoke Pro
      await pool.query(
        `UPDATE subscriptions
         SET plan = 'free', status = 'active', expires_at = NULL
         WHERE user_id = $1`,
        [userId]
      );

      const newResult = await pool.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [userId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "subscription.revoke_pro",
        entityType: "subscription",
        entityId: userId,
        oldValue,
        newValue: { ...newResult.rows[0], reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        message: "Pro access revoked",
        subscription: newResult.rows[0],
      });
    } catch (err) {
      console.error("Revoke Pro error:", err);
      res.status(500).json({ error: "Failed to revoke Pro access" });
    }
  }
);

export default router;
