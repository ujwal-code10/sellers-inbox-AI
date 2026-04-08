import { Router, Response } from "express";
import pool from "../../utils/db.js";
import {
  adminAuth,
  AdminRequest,
  requireSuperAdmin,
} from "../middleware/adminAuth.js";
import { createAuditLog } from "../services/auditService.js";

const router = Router();

type BillingCycle = "monthly" | "yearly";

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function getBillingFromMetadata(metadata: Record<string, unknown>): BillingCycle {
  return metadata.billing === "yearly" ? "yearly" : "monthly";
}

function calculateExtendedExpiryDate(
  billing: BillingCycle,
  currentExpiresAt?: Date | string | null
): Date {
  const now = new Date();
  const parsedCurrent = currentExpiresAt ? new Date(currentExpiresAt) : null;

  const baseDate =
    parsedCurrent && !isNaN(parsedCurrent.getTime()) && parsedCurrent > now
      ? parsedCurrent
      : now;

  const expiresAt = new Date(baseDate);
  if (billing === "yearly") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt;
}

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

// POST /admin/transactions/:id/approve - Approve pending manual QR payment
router.post(
  "/:id/approve",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    const transactionId = parseInt(String(req.params.id), 10);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim().slice(0, 300)
        : null;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const transactionResult = await client.query(
        `SELECT id, user_id, type, status, payment_method, payment_ref, metadata
         FROM transactions
         WHERE id = $1
         FOR UPDATE`,
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Transaction not found" });
      }

      const transaction = transactionResult.rows[0] as {
        id: number;
        user_id: number | null;
        type: string;
        status: string;
        payment_method: string | null;
        payment_ref: string | null;
        metadata: unknown;
      };

      const isValidTarget =
        transaction.status === "pending" &&
        transaction.type === "subscription" &&
        transaction.payment_method === "manual_qr";

      if (!isValidTarget) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "Only pending manual QR subscription transactions can be approved",
        });
      }

      if (!transaction.user_id) {
        await client.query("ROLLBACK");
        return res.status(422).json({
          error: "Transaction has no linked user and cannot be approved",
        });
      }

      const metadata = normalizeMetadata(transaction.metadata);
      const billing = getBillingFromMetadata(metadata);

      const previousSubscriptionResult = await client.query(
        `SELECT * FROM subscriptions WHERE user_id = $1`,
        [transaction.user_id]
      );
      const oldSubscription = previousSubscriptionResult.rows[0] || null;
      const expiresAt = calculateExtendedExpiryDate(
        billing,
        oldSubscription?.expires_at || null
      );

      const reviewedMetadata = {
        ...metadata,
        review: {
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminId || null,
          reason,
        },
      };

      const updatedTransactionResult = await client.query(
        `UPDATE transactions
         SET status = 'completed', metadata = $2::jsonb
         WHERE id = $1
         RETURNING *`,
        [transactionId, JSON.stringify(reviewedMetadata)]
      );

      const updatedTransaction = updatedTransactionResult.rows[0];

      const updatedSubscriptionResult = await client.query(
        `INSERT INTO subscriptions
           (user_id, plan, billing, status, started_at, expires_at, payment_ref)
         VALUES ($1, 'pro', $2, 'active', NOW(), $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           plan = 'pro',
           billing = $2,
           status = 'active',
           started_at = NOW(),
           expires_at = $3,
           payment_ref = $4
         RETURNING *`,
        [transaction.user_id, billing, expiresAt, transaction.payment_ref]
      );

      const subscription = updatedSubscriptionResult.rows[0];

      await client.query("COMMIT");

      await createAuditLog({
        adminId: req.adminId!,
        action: "transaction.approve_manual_qr",
        entityType: "transaction",
        entityId: transactionId,
        oldValue: {
          status: transaction.status,
          metadata: transaction.metadata,
          subscription: oldSubscription,
        },
        newValue: {
          status: "completed",
          reason,
          subscription,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.json({
        message: "Transaction approved and Pro plan activated",
        transaction: updatedTransaction,
        subscription,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback error and return the original failure.
      }

      console.error("Approve transaction error:", err);
      return res.status(500).json({ error: "Failed to approve transaction" });
    } finally {
      client.release();
    }
  }
);

// POST /admin/transactions/:id/reject - Reject pending manual QR payment
router.post(
  "/:id/reject",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    const transactionId = parseInt(String(req.params.id), 10);
    if (isNaN(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    const reasonInput =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (reasonInput.length < 3) {
      return res.status(400).json({
        error: "Rejection reason must be at least 3 characters",
      });
    }

    const reason = reasonInput.slice(0, 300);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const transactionResult = await client.query(
        `SELECT id, user_id, type, status, payment_method, metadata
         FROM transactions
         WHERE id = $1
         FOR UPDATE`,
        [transactionId]
      );

      if (transactionResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Transaction not found" });
      }

      const transaction = transactionResult.rows[0] as {
        id: number;
        user_id: number | null;
        type: string;
        status: string;
        payment_method: string | null;
        metadata: unknown;
      };

      const isValidTarget =
        transaction.status === "pending" &&
        transaction.type === "subscription" &&
        transaction.payment_method === "manual_qr";

      if (!isValidTarget) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error:
            "Only pending manual QR subscription transactions can be rejected",
        });
      }

      const metadata = normalizeMetadata(transaction.metadata);
      const reviewedMetadata = {
        ...metadata,
        review: {
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.adminId || null,
          reason,
        },
      };

      const updatedTransactionResult = await client.query(
        `UPDATE transactions
         SET status = 'failed', metadata = $2::jsonb
         WHERE id = $1
         RETURNING *`,
        [transactionId, JSON.stringify(reviewedMetadata)]
      );

      const updatedTransaction = updatedTransactionResult.rows[0];

      await client.query("COMMIT");

      await createAuditLog({
        adminId: req.adminId!,
        action: "transaction.reject_manual_qr",
        entityType: "transaction",
        entityId: transactionId,
        oldValue: {
          status: transaction.status,
          metadata: transaction.metadata,
        },
        newValue: {
          status: "failed",
          reason,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return res.json({
        message: "Transaction rejected",
        transaction: updatedTransaction,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback error and return the original failure.
      }

      console.error("Reject transaction error:", err);
      return res.status(500).json({ error: "Failed to reject transaction" });
    } finally {
      client.release();
    }
  }
);

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
