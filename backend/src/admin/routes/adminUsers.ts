import { Router, Response } from "express";
import pool from "../../utils/db.js";
import {
  adminAuth,
  AdminRequest,
  requireSuperAdmin,
} from "../middleware/adminAuth.js";
import { createAuditLog } from "../services/auditService.js";

const router = Router();

// GET /admin/users - List users with pagination and filters
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search,
      status,
      plan,
      sort = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(
        `(u.email ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`
      );
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (status === "active") {
      conditions.push(`u.banned_at IS NULL`);
    } else if (status === "banned") {
      conditions.push(`u.banned_at IS NOT NULL`);
    }

    if (plan === "free") {
      conditions.push(`(s.plan IS NULL OR s.plan = 'free')`);
    } else if (plan === "pro") {
      conditions.push(`s.plan = 'pro'`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Validate sort column
    const allowedSorts = ["created_at", "name", "email"];
    const sortColumn = allowedSorts.includes(sort as string)
      ? sort
      : "created_at";
    const sortOrder = order === "asc" ? "ASC" : "DESC";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT u.id)
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated users
    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.created_at, u.banned_at, u.ban_reason,
         s.plan, s.status as subscription_status, s.expires_at,
         (SELECT COUNT(*) FROM products WHERE user_id = u.id) as product_count,
         (SELECT COALESCE(SUM(reply_count), 0) FROM usage_daily WHERE user_id = u.id) as total_replies
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       ${whereClause}
       ORDER BY u.${sortColumn} ${sortOrder}
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
    console.error("List users error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// GET /admin/users/:id - Get user details
router.get("/:id", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Get user with subscription
    const userResult = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.created_at, u.banned_at, u.banned_by, u.ban_reason,
         s.plan, s.billing, s.status as subscription_status, s.started_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    // Get products count
    const productsResult = await pool.query(
      `SELECT COUNT(*) FROM products WHERE user_id = $1`,
      [userId]
    );

    // Get usage stats
    const usageResult = await pool.query(
      `SELECT
         COALESCE(SUM(reply_count), 0) as total_replies,
         COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN reply_count ELSE 0 END), 0) as replies_today,
         COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN reply_count ELSE 0 END), 0) as replies_this_week
       FROM usage_daily
       WHERE user_id = $1`,
      [userId]
    );

    // Get recent transactions
    const transactionsResult = await pool.query(
      `SELECT id, type, amount, status, payment_method, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      user,
      stats: {
        product_count: parseInt(productsResult.rows[0].count, 10),
        ...usageResult.rows[0],
      },
      recent_transactions: transactionsResult.rows,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// PATCH /admin/users/:id/ban - Ban user
router.patch(
  "/:id/ban",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.id), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const { reason } = req.body;

      // Check if user exists
      const checkResult = await pool.query(
        `SELECT id, banned_at FROM users WHERE id = $1`,
        [userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      if (checkResult.rows[0].banned_at) {
        return res.status(400).json({ error: "User is already banned" });
      }

      // Ban the user
      await pool.query(
        `UPDATE users
         SET banned_at = NOW(), banned_by = $1, ban_reason = $2
         WHERE id = $3`,
        [req.adminId, reason || null, userId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "user.ban",
        entityType: "user",
        entityId: userId,
        oldValue: { banned_at: null },
        newValue: { banned_at: new Date(), ban_reason: reason },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "User banned successfully" });
    } catch (err) {
      console.error("Ban user error:", err);
      res.status(500).json({ error: "Failed to ban user" });
    }
  }
);

// PATCH /admin/users/:id/unban - Unban user
router.patch(
  "/:id/unban",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.id), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      // Check if user exists and is banned
      const checkResult = await pool.query(
        `SELECT id, banned_at, ban_reason FROM users WHERE id = $1`,
        [userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!checkResult.rows[0].banned_at) {
        return res.status(400).json({ error: "User is not banned" });
      }

      const oldValue = {
        banned_at: checkResult.rows[0].banned_at,
        ban_reason: checkResult.rows[0].ban_reason,
      };

      // Unban the user
      await pool.query(
        `UPDATE users
         SET banned_at = NULL, banned_by = NULL, ban_reason = NULL
         WHERE id = $1`,
        [userId]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "user.unban",
        entityType: "user",
        entityId: userId,
        oldValue,
        newValue: { banned_at: null, ban_reason: null },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "User unbanned successfully" });
    } catch (err) {
      console.error("Unban user error:", err);
      res.status(500).json({ error: "Failed to unban user" });
    }
  }
);

// GET /admin/users/:id/usage - Get user AI usage history
router.get("/:id/usage", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { days = "30" } = req.query;
    const parsedDays = parseInt(days as string, 10);
    const daysNum = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(1, parsedDays))
      : 30;

    const result = await pool.query(
      `SELECT date, reply_count
       FROM usage_daily
       WHERE user_id = $1 AND date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
       ORDER BY date DESC`,
      [userId, daysNum]
    );

    res.json({ data: result.rows });
  } catch (err) {
    console.error("Get user usage error:", err);
    res.status(500).json({ error: "Failed to get user usage" });
  }
});

// GET /admin/users/:id/transactions - Get user transactions
router.get(
  "/:id/transactions",
  adminAuth,
  async (req: AdminRequest, res: Response) => {
    try {
      const userId = parseInt(String(req.params.id), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const result = await pool.query(
        `SELECT id, type, amount, currency, status, payment_method, payment_ref, created_at
         FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({ data: result.rows });
    } catch (err) {
      console.error("Get user transactions error:", err);
      res.status(500).json({ error: "Failed to get user transactions" });
    }
  }
);

export default router;
