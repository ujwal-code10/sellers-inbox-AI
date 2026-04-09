import pool from "../utils/db.js";
import { BillingCycle } from "../models/payment.js";

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

export async function selectSubscriptionOverviewByUser(userId: number) {
  const result = await pool.query(
    `SELECT plan, billing, status, expires_at FROM subscriptions
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function selectRepliesUsedTodayByUser(userId: number): Promise<number> {
  const result = await pool.query(
    `SELECT reply_count FROM usage_daily
     WHERE user_id = $1 AND date = CURRENT_DATE`,
    [userId]
  );

  return Number(result.rows[0]?.reply_count || 0);
}

export async function countProductsByUser(userId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM products WHERE user_id = $1`,
    [userId]
  );

  return parseInt(String(result.rows[0]?.count || "0"), 10);
}

export async function selectLatestPendingManualQrByUser(userId: number) {
  const result = await pool.query(
    `SELECT id, amount, payment_ref, metadata, created_at
     FROM transactions
     WHERE user_id = $1
       AND type = 'subscription'
       AND payment_method = 'manual_qr'
       AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

export async function acquireAdvisoryLock(
  client: QueryExecutor,
  lockKey: string
): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
}

export async function existsManualQrByReference(
  client: QueryExecutor,
  paymentReference: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT id FROM transactions
     WHERE payment_method = 'manual_qr' AND payment_ref = $1
     LIMIT 1`,
    [paymentReference]
  );

  return result.rows.length > 0;
}

export async function existsPendingManualQrByUser(
  client: QueryExecutor,
  userId: number
): Promise<boolean> {
  const result = await client.query(
    `SELECT id FROM transactions
     WHERE user_id = $1
       AND type = 'subscription'
       AND payment_method = 'manual_qr'
       AND status = 'pending'
     LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0;
}

export async function insertPendingManualQrTransaction(
  client: QueryExecutor,
  params: {
    userId: number;
    amount: number;
    paymentReference: string;
    metadataJson: string;
  }
) {
  const result = await client.query(
    `INSERT INTO transactions
      (user_id, type, amount, currency, status, payment_method, payment_ref, metadata)
     VALUES ($1, 'subscription', $2, 'NPR', 'pending', 'manual_qr', $3, $4::jsonb)
     RETURNING id, created_at`,
    [params.userId, params.amount, params.paymentReference, params.metadataJson]
  );

  return result.rows[0] as { id: number; created_at: string };
}

export async function existsSubscriptionByPaymentRef(
  client: QueryExecutor,
  paymentRef: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT id FROM subscriptions WHERE payment_ref = $1 LIMIT 1`,
    [paymentRef]
  );

  return result.rows.length > 0;
}

export async function existsEsewaTransactionByPaymentRef(
  client: QueryExecutor,
  paymentRef: string
): Promise<boolean> {
  const result = await client.query(
    `SELECT id FROM transactions
     WHERE payment_method = 'esewa' AND payment_ref = $1
     LIMIT 1`,
    [paymentRef]
  );

  return result.rows.length > 0;
}

export async function selectSubscriptionExpiryByUser(
  client: QueryExecutor,
  userId: number
): Promise<Date | string | null> {
  const result = await client.query(
    `SELECT expires_at FROM subscriptions WHERE user_id = $1`,
    [userId]
  );

  return (result.rows[0]?.expires_at as Date | string | null | undefined) || null;
}

export async function upsertActiveProSubscription(
  client: QueryExecutor,
  params: {
    userId: number;
    billing: BillingCycle;
    expiresAt: Date;
    paymentRef: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO subscriptions
       (user_id, plan, billing, status, started_at, expires_at, payment_ref)
     VALUES ($1, 'pro', $2, 'active', now(), $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       plan = 'pro',
       billing = $2,
       status = 'active',
       started_at = now(),
       expires_at = $3,
       payment_ref = $4`,
    [params.userId, params.billing, params.expiresAt, params.paymentRef]
  );
}

export async function insertCompletedEsewaTransaction(
  client: QueryExecutor,
  params: {
    userId: number;
    amount: string;
    paymentRef: string;
    metadataJson: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO transactions
       (user_id, type, amount, currency, status, payment_method, payment_ref, metadata)
     VALUES ($1, 'subscription', $2, 'NPR', 'completed', 'esewa', $3, $4::jsonb)`,
    [params.userId, params.amount, params.paymentRef, params.metadataJson]
  );
}