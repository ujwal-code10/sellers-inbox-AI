import express from "express";
import crypto from "crypto";
import pool from "../utils/db.js";
import auth, { AuthRequest } from "../middleware/auth.js";

const router = express.Router();

// eSewa config
const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
// CRITICAL: No fallback for production - must be set in environment
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY!;
const ESEWA_VERIFY_URL =
  process.env.NODE_ENV === "production"
    ? "https://epay.esewa.com.np/api/epay/transaction/status/"
    : "https://rc-epay.esewa.com.np/api/epay/transaction/status/";

const PLAN_PRICES = {
  pro_monthly: 299,
  pro_yearly: 2499,
};

// Generate HMAC-SHA256 signature for eSewa
function generateSignature(message: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("base64");
}

/**
 * GET /api/payments/plans
 * Returns plan info and current user's plan
 */
router.get("/plans", auth, async (req: AuthRequest, res) => {
  try {
    const subRes = await pool.query(
      `SELECT plan, billing, status, expires_at FROM subscriptions
       WHERE user_id = $1`,
      [req.userId]
    );

    const sub = subRes.rows[0] || null;

    const usageRes = await pool.query(
      `SELECT reply_count FROM usage_daily
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [req.userId]
    );

    const repliesUsedToday = usageRes.rows[0]?.reply_count || 0;

    const productCountRes = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE user_id = $1`,
      [req.userId]
    );

    const productCount = parseInt(productCountRes.rows[0].count);

    res.json({
      current: {
        plan: sub?.plan || "free",
        billing: sub?.billing || null,
        status: sub?.status || "active",
        expires_at: sub?.expires_at || null,
      },
      usage: {
        replies_today: repliesUsedToday,
        replies_limit: sub?.plan === "pro" ? null : 20,
        products: productCount,
        products_limit: sub?.plan === "pro" ? null : 5,
      },
      plans: {
        free: { price: 0, replies_per_day: 20, products: 5 },
        pro_monthly: { price: 299, replies_per_day: null, products: null },
        pro_yearly: { price: 2499, replies_per_day: null, products: null },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/payments/esewa/initiate
 * Returns eSewa payment form data
 */
router.post("/esewa/initiate", auth, async (req: AuthRequest, res) => {
  const { billing } = req.body; // 'monthly' or 'yearly'

  if (!billing || !["monthly", "yearly"].includes(billing)) {
    return res.status(400).json({ error: "billing must be monthly or yearly" });
  }

  const amount =
    billing === "yearly"
      ? PLAN_PRICES.pro_yearly
      : PLAN_PRICES.pro_monthly;

  const transactionUuid = `SIA-${req.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const productCode = ESEWA_MERCHANT_CODE;

  // eSewa v2 signature: total_amount,transaction_uuid,product_code
  const signatureMessage = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = generateSignature(signatureMessage, ESEWA_SECRET_KEY);

  const successUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/success`;
  const failureUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/failure`;

  res.json({
    amount,
    billing,
    transactionUuid,
    productCode,
    signature,
    successUrl,
    failureUrl,
    esewaUrl:
      process.env.NODE_ENV === "production"
        ? "https://epay.esewa.com.np/api/epay/main/v2/form"
        : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  });
});

/**
 * POST /api/payments/esewa/verify
 * Called after eSewa redirects back with encoded data
 */
router.post("/esewa/verify", auth, async (req: AuthRequest, res) => {
  const { encodedData, billing } = req.body;

  if (!encodedData) {
    return res.status(400).json({ error: "encodedData is required" });
  }

  try {
    // Decode base64 response from eSewa
    const decoded = JSON.parse(
      Buffer.from(encodedData, "base64").toString("utf-8")
    );

    const {
      transaction_uuid,
      total_amount,
      status,
      transaction_code,
      signed_field_names,
      signature: esewaSignature,
    } = decoded;

    // CRITICAL: Validate payment amount matches expected plan price
    const expectedAmount = billing === 'yearly'
      ? PLAN_PRICES.pro_yearly
      : PLAN_PRICES.pro_monthly;

    if (parseFloat(total_amount) !== expectedAmount) {
      console.error(`Payment amount mismatch: expected ${expectedAmount}, got ${total_amount}`);
      return res.status(400).json({
        error: "Payment amount mismatch"
      });
    }

    // Verify signature from eSewa
    const signedFields = signed_field_names.split(",");
    const signatureMessage = signedFields
      .map((field: string) => `${field}=${decoded[field]}`)
      .join(",");

    const expectedSignature = generateSignature(
      signatureMessage,
      ESEWA_SECRET_KEY
    );

    if (expectedSignature !== esewaSignature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    if (status !== "COMPLETE") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Double-check with eSewa API
    const verifyResponse = await fetch(
      `${ESEWA_VERIFY_URL}?product_code=${ESEWA_MERCHANT_CODE}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`
    );
    const verifyData = await verifyResponse.json();

    if (verifyData.status !== "COMPLETE") {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // CRITICAL: Prevent duplicate payment processing (replay attack)
    const existingPayment = await pool.query(
      `SELECT id FROM subscriptions WHERE payment_ref = $1`,
      [transaction_code]
    );

    if (existingPayment.rows.length > 0) {
      console.error(`Duplicate payment attempt with transaction_code: ${transaction_code}`);
      return res.status(400).json({ error: "Payment already processed" });
    }

    // Calculate expiry
    const now = new Date();
    const expiresAt = new Date(now);
    if (billing === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Save subscription
    await pool.query(
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
      [req.userId, billing || "monthly", expiresAt, transaction_code]
    );

    res.json({
      success: true,
      plan: "pro",
      billing: billing || "monthly",
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("eSewa verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;