import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.js";
import pool from "../utils/db.js";

// Temporary: generous limits during beta testing
export const FREE_REPLY_LIMIT = 99; //was 20
export const FREE_PRODUCT_LIMIT = 99;// was 5

// Check daily reply limit for free users
export async function checkReplyLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId!;

    // Get user's plan
    const subRes = await pool.query(
      `SELECT plan, status, expires_at FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    const sub = subRes.rows[0];
    const isPro =
      sub &&
      sub.plan === "pro" &&
      sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at) > new Date());

    // Pro users have no limit
    if (isPro) return next();

    // Free users — check daily count
    const today = new Date().toISOString().split("T")[0];
    const usageRes = await pool.query(
      `SELECT reply_count FROM usage_daily
       WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );

    const count = usageRes.rows[0]?.reply_count || 0;

    if (count >= FREE_REPLY_LIMIT) {
      return res.status(429).json({
        error: "Daily limit reached",
        limit: FREE_REPLY_LIMIT,
        used: count,
        upgrade: true,
      });
    }

    next();
  } catch (err) {
    console.error("checkReplyLimit error:", err);
    // CRITICAL: Deny access on error instead of allowing bypass
    return res.status(503).json({
      error: "Service temporarily unavailable. Please try again."
    });
  }
}

// Increment daily reply count after successful generation
export async function incrementReplyCount(userId: number): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO usage_daily (user_id, date, reply_count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, date)
     DO UPDATE SET reply_count = usage_daily.reply_count + 1`,
    [userId, today]
  );
}

// Check product limit for free users
export async function checkProductLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId!;

    const subRes = await pool.query(
      `SELECT plan, status, expires_at FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    const sub = subRes.rows[0];
    const isPro =
      sub &&
      sub.plan === "pro" &&
      sub.status === "active" &&
      (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (isPro) return next();

    const countRes = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE user_id = $1`,
      [userId]
    );

    const count = parseInt(countRes.rows[0].count);

    if (count >= FREE_PRODUCT_LIMIT) {
      return res.status(403).json({
        error: "Product limit reached",
        limit: FREE_PRODUCT_LIMIT,
        used: count,
        upgrade: true,
      });
    }

    next();
  } catch (err) {
    console.error("checkProductLimit error:", err);
    // CRITICAL: Deny access on error instead of allowing bypass
    return res.status(503).json({
      error: "Service temporarily unavailable. Please try again."
    });
  }
}