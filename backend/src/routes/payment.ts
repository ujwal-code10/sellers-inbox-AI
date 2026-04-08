import express from "express";
import crypto from "crypto";
import pool from "../utils/db.js";
import auth, { AuthRequest } from "../middleware/auth.js";
import { getEffectiveFreeTierLimits } from "../utils/freeTierLimits.js";

const router = express.Router();

// eSewa config
const ESEWA_MERCHANT_CODE = process.env.ESEWA_MERCHANT_CODE || "EPAYTEST";
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "";
const ESEWA_VERIFY_URL =
  process.env.NODE_ENV === "production"
    ? "https://epay.esewa.com.np/api/epay/transaction/status/"
    : "https://rc-epay.esewa.com.np/api/epay/transaction/status/";

const PLAN_PRICES = {
  pro_monthly: 299,
  pro_yearly: 2499,
};

function normalizeManualQrImageUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const sanitizedPath = trimmed
    .replace(/^\.\//, "")
    .replace(/^public\//i, "")
    .replace(/^\/+/, "");

  if (!sanitizedPath) {
    return null;
  }

  return `/${sanitizedPath}`;
}

type BillingCycle = "monthly" | "yearly";

interface ParsedEsewaTransactionUuid {
  userId: number | null;
  billing: BillingCycle | null;
}

const MANUAL_QR_RECEIVER_ID_PLACEHOLDER = "Configure MANUAL_QR_RECEIVER_ID";

const MANUAL_QR_IMAGE_URL = normalizeManualQrImageUrl(
  process.env.MANUAL_QR_IMAGE_URL || null
);
const MANUAL_QR_RECEIVER_NAME =
  process.env.MANUAL_QR_RECEIVER_NAME || "Seller Inbox AI";
const MANUAL_QR_RECEIVER_ID =
  process.env.MANUAL_QR_RECEIVER_ID || MANUAL_QR_RECEIVER_ID_PLACEHOLDER;
const MANUAL_QR_SUPPORT_TEXT =
  process.env.MANUAL_QR_SUPPORT_TEXT ||
  "Submit your payment reference after transfer. Our team verifies and activates Pro quickly.";

function isEsewaConfigured(): boolean {
  return Boolean(ESEWA_SECRET_KEY);
}

function isManualQrConfigured(): boolean {
  return (
    Boolean(MANUAL_QR_IMAGE_URL) &&
    Boolean(MANUAL_QR_RECEIVER_ID) &&
    MANUAL_QR_RECEIVER_ID !== MANUAL_QR_RECEIVER_ID_PLACEHOLDER
  );
}

function normalizeManualReference(reference: string): string {
  return reference.trim().toUpperCase();
}

function parseBillingCycle(value: unknown): BillingCycle | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }
  return null;
}

function parseEsewaTransactionUuid(
  rawValue: unknown
): ParsedEsewaTransactionUuid {
  if (typeof rawValue !== "string") {
    return { userId: null, billing: null };
  }

  const parts = rawValue.split("-");
  if (parts.length < 4 || parts[0] !== "SIA") {
    return { userId: null, billing: null };
  }

  const userId = parseInt(parts[1], 10);
  if (isNaN(userId) || userId <= 0) {
    return { userId: null, billing: null };
  }

  const billing = parseBillingCycle(parts[2]);

  return {
    userId,
    billing,
  };
}

function calculateExpiryDate(
  billing: BillingCycle,
  currentExpiresAt?: Date | string | null
): Date {
  const now = new Date();

  const parsedCurrentExpiry = currentExpiresAt
    ? new Date(currentExpiresAt)
    : null;

  const baseDate =
    parsedCurrentExpiry &&
    !isNaN(parsedCurrentExpiry.getTime()) &&
    parsedCurrentExpiry > now
      ? parsedCurrentExpiry
      : now;

  const nextExpiry = new Date(baseDate);
  if (billing === "yearly") {
    nextExpiry.setFullYear(nextExpiry.getFullYear() + 1);
  } else {
    nextExpiry.setMonth(nextExpiry.getMonth() + 1);
  }

  return nextExpiry;
}

function getPlanAmount(billing: BillingCycle): number {
  return billing === "yearly" ? PLAN_PRICES.pro_yearly : PLAN_PRICES.pro_monthly;
}

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
    const limits = await getEffectiveFreeTierLimits();

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
        replies_limit: sub?.plan === "pro" ? null : limits.dailyReplies,
        products: productCount,
        products_limit: sub?.plan === "pro" ? null : limits.maxProducts,
      },
      plans: {
        free: {
          price: 0,
          replies_per_day: limits.dailyReplies,
          products: limits.maxProducts,
          mode: limits.enforced ? "enforced" : "trust",
        },
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
 * GET /api/payments/manual-qr/config
 * Returns manual QR payment configuration
 */
router.get("/manual-qr/config", auth, async (_req: AuthRequest, res) => {
  const configured = isManualQrConfigured();

  res.json({
    enabled: configured,
    qr_image_url: MANUAL_QR_IMAGE_URL,
    receiver_name: MANUAL_QR_RECEIVER_NAME,
    receiver_id: MANUAL_QR_RECEIVER_ID,
    support_text: MANUAL_QR_SUPPORT_TEXT,
    amounts: {
      monthly: PLAN_PRICES.pro_monthly,
      yearly: PLAN_PRICES.pro_yearly,
    },
  });
});

/**
 * GET /api/payments/manual-qr/status
 * Returns latest pending manual QR request for current user
 */
router.get("/manual-qr/status", auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount, payment_ref, metadata, created_at
       FROM transactions
       WHERE user_id = $1
         AND type = 'subscription'
         AND payment_method = 'manual_qr'
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ pending: false });
    }

    const row = result.rows[0];
    const metadata =
      row.metadata && typeof row.metadata === "object" ? row.metadata : {};

    const submittedAt =
      typeof metadata.submitted_at === "string"
        ? metadata.submitted_at
        : row.created_at;

    return res.json({
      pending: true,
      request: {
        transaction_id: row.id,
        amount: Number(row.amount) || 0,
        payment_reference: row.payment_ref,
        billing: metadata.billing === "yearly" ? "yearly" : "monthly",
        payer_name:
          typeof metadata.payer_name === "string" ? metadata.payer_name : null,
        note: typeof metadata.note === "string" ? metadata.note : null,
        submitted_at: submittedAt,
      },
    });
  } catch (err) {
    console.error("Manual QR status error:", err);
    return res.status(500).json({ error: "Could not load payment status" });
  }
});

/**
 * POST /api/payments/manual-qr/submit
 * Submits manual QR payment reference for verification
 */
router.post("/manual-qr/submit", auth, async (req: AuthRequest, res) => {
  if (!isManualQrConfigured()) {
    return res.status(503).json({
      error:
        "Manual QR payments are not configured yet on the server. Please contact support.",
    });
  }

  const { billing, paymentReference, payerName, note } = req.body as {
    billing?: BillingCycle;
    paymentReference?: string;
    payerName?: string;
    note?: string;
  };

  const parsedBilling = parseBillingCycle(billing);

  if (!parsedBilling) {
    return res.status(400).json({ error: "billing must be monthly or yearly" });
  }

  if (typeof paymentReference !== "string") {
    return res.status(400).json({ error: "paymentReference is required" });
  }

  const cleanedReference = normalizeManualReference(paymentReference);
  if (cleanedReference.length < 4 || cleanedReference.length > 80) {
    return res
      .status(400)
      .json({ error: "paymentReference must be 4-80 characters" });
  }

  if (!/^[a-zA-Z0-9/_-]+$/.test(cleanedReference)) {
    return res.status(400).json({
      error:
        "paymentReference can only contain letters, numbers, slash, underscore, or dash",
    });
  }

  if (typeof payerName !== "string" || payerName.trim().length < 2) {
    return res.status(400).json({
      error: "payerName is required for verification",
    });
  }

  const cleanedPayerName = payerName.trim().slice(0, 120);

  const cleanedNote =
    typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock by normalized reference + user id to avoid race-condition duplicates.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `manual_qr_ref:${cleanedReference}`,
    ]);
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `manual_qr_user:${req.userId}`,
    ]);

    const duplicateRef = await client.query(
      `SELECT id FROM transactions
       WHERE payment_method = 'manual_qr' AND payment_ref = $1
       LIMIT 1`,
      [cleanedReference]
    );

    if (duplicateRef.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error:
          "This payment reference is already submitted. Please verify the reference and try again.",
      });
    }

    // Allow one pending manual subscription request per user at a time.
    const existingPending = await client.query(
      `SELECT id FROM transactions
       WHERE user_id = $1
         AND type = 'subscription'
         AND payment_method = 'manual_qr'
         AND status = 'pending'
       LIMIT 1`,
      [req.userId]
    );

    if (existingPending.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error:
          "You already have a pending QR payment request. Please wait for verification.",
      });
    }

    const amount = getPlanAmount(parsedBilling);
    const metadata = {
      billing: parsedBilling,
      payer_name: cleanedPayerName,
      note: cleanedNote,
      submitted_at: new Date().toISOString(),
      source: "manual_qr",
    };

    const created = await client.query(
      `INSERT INTO transactions
        (user_id, type, amount, currency, status, payment_method, payment_ref, metadata)
       VALUES ($1, 'subscription', $2, 'NPR', 'pending', 'manual_qr', $3, $4::jsonb)
       RETURNING id, created_at`,
      [req.userId, amount, cleanedReference, JSON.stringify(metadata)]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      status: "pending_review",
      transaction_id: created.rows[0].id,
      amount,
      requires_admin_approval: true,
      access_activated: false,
      submitted_at: created.rows[0].created_at,
      message:
        "Payment request submitted. Pro access will activate only after admin verification.",
    });
  } catch (err: any) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure and return original error.
    }

    if (err.code === "42P01") {
      return res.status(503).json({
        error:
          "Manual QR payments are not configured yet on the server. Please contact support.",
      });
    }

    console.error("Manual QR submit error:", err);
    return res.status(500).json({ error: "Could not submit payment" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/payments/esewa/initiate
 * Returns eSewa payment form data
 */
router.post("/esewa/initiate", auth, async (req: AuthRequest, res) => {
  if (!isEsewaConfigured()) {
    return res.status(503).json({
      error: "eSewa is not configured on the server.",
    });
  }

  const { billing } = req.body as { billing?: BillingCycle }; // 'monthly' or 'yearly'
  const parsedBilling = parseBillingCycle(billing);

  if (!parsedBilling) {
    return res.status(400).json({ error: "billing must be monthly or yearly" });
  }

  const amount = getPlanAmount(parsedBilling);

  const transactionUuid = `SIA-${req.userId}-${parsedBilling}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const productCode = ESEWA_MERCHANT_CODE;

  // eSewa v2 signature: total_amount,transaction_uuid,product_code
  const signatureMessage = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = generateSignature(signatureMessage, ESEWA_SECRET_KEY);

  const successUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/success`;
  const failureUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/failure`;

  res.json({
    amount,
    billing: parsedBilling,
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
router.post("/esewa/verify", async (req: express.Request, res) => {
  if (!isEsewaConfigured()) {
    return res.status(503).json({
      error: "eSewa is not configured on the server.",
    });
  }

  const { encodedData, billing } = req.body as {
    encodedData?: string;
    billing?: BillingCycle;
  };

  if (!encodedData || typeof encodedData !== "string") {
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

    if (
      typeof transaction_uuid !== "string" ||
      typeof total_amount !== "string" ||
      typeof transaction_code !== "string" ||
      typeof signed_field_names !== "string" ||
      typeof esewaSignature !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payment response payload" });
    }

    const parsedUuid = parseEsewaTransactionUuid(transaction_uuid);
    if (!parsedUuid.userId) {
      return res.status(400).json({ error: "Invalid transaction UUID" });
    }

    const fallbackBilling = parseBillingCycle(billing) || "monthly";
    const resolvedBilling = parsedUuid.billing || fallbackBilling;
    const targetUserId = parsedUuid.userId;

    // CRITICAL: Validate payment amount matches expected plan price
    const expectedAmount = getPlanAmount(resolvedBilling);

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

    if (!verifyResponse.ok) {
      return res.status(502).json({ error: "Payment verification provider unavailable" });
    }

    const verifyData = await verifyResponse.json();

    if (verifyData.status !== "COMPLETE") {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    if (
      verifyData.transaction_uuid &&
      verifyData.transaction_uuid !== transaction_uuid
    ) {
      return res.status(400).json({ error: "Verification mismatch" });
    }

    if (
      verifyData.total_amount &&
      parseFloat(String(verifyData.total_amount)) !== expectedAmount
    ) {
      return res.status(400).json({ error: "Verified amount mismatch" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock on transaction code + user to prevent replay race conditions.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `esewa_code:${transaction_code}`,
      ]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `esewa_user:${targetUserId}`,
      ]);

      const existingPayment = await client.query(
        `SELECT id FROM subscriptions WHERE payment_ref = $1 LIMIT 1`,
        [transaction_code]
      );

      if (existingPayment.rows.length > 0) {
        await client.query("ROLLBACK");
        console.error(`Duplicate payment attempt with transaction_code: ${transaction_code}`);
        return res.status(400).json({ error: "Payment already processed" });
      }

      const existingTransaction = await client.query(
        `SELECT id FROM transactions
         WHERE payment_method = 'esewa' AND payment_ref = $1
         LIMIT 1`,
        [transaction_code]
      );

      if (existingTransaction.rows.length > 0) {
        await client.query("ROLLBACK");
        console.error(
          `Duplicate transaction record attempt with transaction_code: ${transaction_code}`
        );
        return res.status(400).json({ error: "Payment already processed" });
      }

      const currentSubscription = await client.query(
        `SELECT expires_at FROM subscriptions WHERE user_id = $1`,
        [targetUserId]
      );

      const currentExpiresAt = currentSubscription.rows[0]?.expires_at || null;
      const expiresAt = calculateExpiryDate(resolvedBilling, currentExpiresAt);

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
        [targetUserId, resolvedBilling, expiresAt, transaction_code]
      );

      await client.query(
        `INSERT INTO transactions
           (user_id, type, amount, currency, status, payment_method, payment_ref, metadata)
         VALUES ($1, 'subscription', $2, 'NPR', 'completed', 'esewa', $3, $4::jsonb)`,
        [
          targetUserId,
          total_amount,
          transaction_code,
          JSON.stringify({
            billing: resolvedBilling,
            esewa_transaction_code: transaction_code,
            esewa_transaction_uuid: transaction_uuid,
            verified_at: new Date().toISOString(),
            source: "esewa_payment",
          }),
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        plan: "pro",
        billing: resolvedBilling,
        expires_at: expiresAt,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Ignore rollback failure and return original error.
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("eSewa verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;