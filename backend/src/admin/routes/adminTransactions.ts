import { Router, Response } from "express";
import pool from "../../utils/db.js";
import { adminAuth, AdminRequest } from "../middleware/adminAuth.js";

const router = Router();

// GET /admin/transactions - List transactions with filters
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      status,
      type,
      user_id,
      from,
      to,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      values.push(status);
    }
    if (type) {
      conditions.push(`t.type = $${paramIndex++}`);
      values.push(type);
    }
    if (user_id) {
      conditions.push(`t.user_id = $${paramIndex++}`);
      values.push(parseInt(user_id as string, 10));
    }
    if (from) {
      conditions.push(`t.created_at >= $${paramIndex++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`t.created_at <= $${paramIndex++}`);
      values.push(to);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated transactions
    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT
         t.id, t.user_id, t.type, t.amount, t.currency, t.status,
         t.payment_method, t.payment_ref, t.metadata, t.created_at,
         u.name as user_name, u.email as user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
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
    console.error("List transactions error:", err);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

// GET /admin/transactions/stats - Transaction statistics
router.get("/stats", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_count,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'completed' THEN amount ELSE 0 END), 0) as today_amount,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_count,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'completed' THEN amount ELSE 0 END), 0) as week_amount,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_count,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed' THEN amount ELSE 0 END), 0) as month_amount,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as total_pending
      FROM transactions
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Transaction stats error:", err);
    res.status(500).json({ error: "Failed to get transaction stats" });
  }
});

// GET /admin/transactions/:id - Get transaction details
router.get("/:id", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const transactionId = parseInt(String(req.params.id), 10);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    const result = await pool.query(
      `SELECT
         t.*,
         u.name as user_name, u.email as user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [transactionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get transaction error:", err);
    res.status(500).json({ error: "Failed to get transaction" });
  }
});

export default router;
