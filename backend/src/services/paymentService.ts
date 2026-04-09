import crypto from "crypto";
import pool from "../utils/db.js";
import { getEffectiveFreeTierLimits } from "../utils/freeTierLimits.js";
import {
  acquireAdvisoryLock,
  countProductsByUser,
  existsEsewaTransactionByPaymentRef,
  existsManualQrByReference,
  existsPendingManualQrByUser,
  existsSubscriptionByPaymentRef,
  insertCompletedEsewaTransaction,
  insertPendingManualQrTransaction,
  selectLatestPendingManualQrByUser,
  selectRepliesUsedTodayByUser,
  selectSubscriptionExpiryByUser,
  selectSubscriptionOverviewByUser,
  upsertActiveProSubscription,
} from "../repositories/paymentRepository.js";
import {
  BillingCycle,
  EsewaVerifyInput,
  ManualQrSubmitInput,
  MANUAL_QR_RECEIVER_ID_PLACEHOLDER,
  ParsedEsewaTransactionUuid,
  PLAN_PRICES,
} from "../models/payment.js";
import { parseBillingCycle } from "../schemas/paymentSchemas.js";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ESEWA_TEST_MERCHANT_CODE = "EPAYTEST";
const ESEWA_MERCHANT_CODE =
  process.env.ESEWA_MERCHANT_CODE?.trim() ||
  (IS_PRODUCTION ? "" : ESEWA_TEST_MERCHANT_CODE);
const ESEWA_SECRET_KEY = process.env.ESEWA_SECRET_KEY || "";
const ESEWA_VERIFY_URL =
  IS_PRODUCTION
    ? "https://epay.esewa.com.np/api/epay/transaction/status/"
    : "https://rc-epay.esewa.com.np/api/epay/transaction/status/";

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

export class PaymentServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "PaymentServiceError";
    this.status = status;
  }
}

function generateSignature(message: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

function parseEsewaTransactionUuid(rawValue: unknown): ParsedEsewaTransactionUuid {
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

  return {
    userId,
    billing: parseBillingCycle(parts[2]),
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

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function isEsewaConfigured(): boolean {
  if (!ESEWA_SECRET_KEY || !ESEWA_MERCHANT_CODE) {
    return false;
  }

  if (IS_PRODUCTION && ESEWA_MERCHANT_CODE === ESEWA_TEST_MERCHANT_CODE) {
    return false;
  }

  return true;
}

export function isManualQrConfigured(): boolean {
  return (
    Boolean(MANUAL_QR_IMAGE_URL) &&
    Boolean(MANUAL_QR_RECEIVER_ID) &&
    MANUAL_QR_RECEIVER_ID !== MANUAL_QR_RECEIVER_ID_PLACEHOLDER
  );
}

export function getManualQrPublicConfig() {
  return {
    enabled: isManualQrConfigured(),
    qr_image_url: MANUAL_QR_IMAGE_URL,
    receiver_name: MANUAL_QR_RECEIVER_NAME,
    receiver_id: MANUAL_QR_RECEIVER_ID,
    support_text: MANUAL_QR_SUPPORT_TEXT,
    amounts: {
      monthly: PLAN_PRICES.pro_monthly,
      yearly: PLAN_PRICES.pro_yearly,
    },
  };
}

export async function getPlansOverview(userId: number) {
  const limits = await getEffectiveFreeTierLimits();
  const [sub, repliesUsedToday, productCount] = await Promise.all([
    selectSubscriptionOverviewByUser(userId),
    selectRepliesUsedTodayByUser(userId),
    countProductsByUser(userId),
  ]);

  return {
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
      pro_monthly: { price: PLAN_PRICES.pro_monthly, replies_per_day: null, products: null },
      pro_yearly: { price: PLAN_PRICES.pro_yearly, replies_per_day: null, products: null },
    },
  };
}

export async function getPendingManualQrStatus(userId: number) {
  const row = await selectLatestPendingManualQrByUser(userId);
  if (!row) {
    return { pending: false };
  }

  const metadata = toRecord(row.metadata);

  const submittedAt =
    typeof metadata.submitted_at === "string"
      ? metadata.submitted_at
      : row.created_at;

  return {
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
  };
}

export async function submitManualQrPayment(params: {
  userId: number;
  input: ManualQrSubmitInput;
}) {
  const { userId, input } = params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await acquireAdvisoryLock(client, `manual_qr_ref:${input.paymentReference}`);
    await acquireAdvisoryLock(client, `manual_qr_user:${userId}`);

    const duplicateRefExists = await existsManualQrByReference(
      client,
      input.paymentReference
    );

    if (duplicateRefExists) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError(
        "This payment reference is already submitted. Please verify the reference and try again.",
        409
      );
    }

    const pendingRequestExists = await existsPendingManualQrByUser(client, userId);

    if (pendingRequestExists) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError(
        "You already have a pending QR payment request. Please wait for verification.",
        409
      );
    }

    const amount = getPlanAmount(input.billing);
    const metadata = {
      billing: input.billing,
      payer_name: input.payerName,
      note: input.note,
      submitted_at: new Date().toISOString(),
      source: "manual_qr",
    };

    const created = await insertPendingManualQrTransaction(client, {
      userId,
      amount,
      paymentReference: input.paymentReference,
      metadataJson: JSON.stringify(metadata),
    });

    await client.query("COMMIT");

    return {
      success: true,
      status: "pending_review",
      transaction_id: created.id,
      amount,
      requires_admin_approval: true,
      access_activated: false,
      submitted_at: created.created_at,
      message:
        "Payment request submitted. Pro access will activate only after admin verification.",
    };
  } catch (err: any) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure and return the original error.
    }

    if (err?.code === "42P01") {
      throw new PaymentServiceError(
        "Manual QR payments are not configured yet on the server. Please contact support.",
        503
      );
    }

    if (err instanceof PaymentServiceError) {
      throw err;
    }

    throw new PaymentServiceError("Could not submit payment", 500);
  } finally {
    client.release();
  }
}

export function createEsewaInitiation(params: {
  userId: number;
  billing: BillingCycle;
  frontendUrl?: string;
}) {
  const amount = getPlanAmount(params.billing);

  const transactionUuid = `SIA-${params.userId}-${params.billing}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const productCode = ESEWA_MERCHANT_CODE;

  const signatureMessage = `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = generateSignature(signatureMessage, ESEWA_SECRET_KEY);

  const rawFrontendUrl = params.frontendUrl?.trim();
  if (!rawFrontendUrl && IS_PRODUCTION) {
    throw new PaymentServiceError(
      "FRONTEND_URL is not configured on the server.",
      503
    );
  }

  const frontendUrl = rawFrontendUrl || "http://localhost:3000";
  const successUrl = `${frontendUrl}/payment/success`;
  const failureUrl = `${frontendUrl}/payment/failure`;

  return {
    amount,
    billing: params.billing,
    transactionUuid,
    productCode,
    signature,
    successUrl,
    failureUrl,
    esewaUrl:
      IS_PRODUCTION
        ? "https://epay.esewa.com.np/api/epay/main/v2/form"
        : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
  };
}

export async function verifyEsewaPayment(input: EsewaVerifyInput) {
  let decoded: Record<string, unknown>;

  try {
    decoded = JSON.parse(Buffer.from(input.encodedData, "base64").toString("utf-8"));
  } catch {
    throw new PaymentServiceError("Invalid payment response payload", 400);
  }

  const transactionUuid = decoded.transaction_uuid;
  const totalAmount = decoded.total_amount;
  const status = decoded.status;
  const transactionCode = decoded.transaction_code;
  const signedFieldNames = decoded.signed_field_names;
  const esewaSignature = decoded.signature;

  if (
    typeof transactionUuid !== "string" ||
    typeof totalAmount !== "string" ||
    typeof transactionCode !== "string" ||
    typeof signedFieldNames !== "string" ||
    typeof esewaSignature !== "string"
  ) {
    throw new PaymentServiceError("Invalid payment response payload", 400);
  }

  const parsedUuid = parseEsewaTransactionUuid(transactionUuid);
  if (!parsedUuid.userId) {
    throw new PaymentServiceError("Invalid transaction UUID", 400);
  }

  const fallbackBilling = input.billing || "monthly";
  const resolvedBilling = parsedUuid.billing || fallbackBilling;
  const targetUserId = parsedUuid.userId;

  const expectedAmount = getPlanAmount(resolvedBilling);
  if (parseFloat(totalAmount) !== expectedAmount) {
    throw new PaymentServiceError("Payment amount mismatch", 400);
  }

  const signedFields = signedFieldNames.split(",");
  const signatureMessage = signedFields
    .map((field: string) => `${field}=${String(decoded[field] ?? "")}`)
    .join(",");

  const expectedSignature = generateSignature(signatureMessage, ESEWA_SECRET_KEY);

  if (expectedSignature !== esewaSignature) {
    throw new PaymentServiceError("Invalid signature", 400);
  }

  if (status !== "COMPLETE") {
    throw new PaymentServiceError("Payment not completed", 400);
  }

  const verifyResponse = await fetch(
    `${ESEWA_VERIFY_URL}?product_code=${ESEWA_MERCHANT_CODE}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`
  );

  if (!verifyResponse.ok) {
    throw new PaymentServiceError("Payment verification provider unavailable", 502);
  }

  const verifyData = toRecord(await verifyResponse.json());

  if (verifyData.status !== "COMPLETE") {
    throw new PaymentServiceError("Payment verification failed", 400);
  }

  if (
    typeof verifyData.transaction_uuid === "string" &&
    verifyData.transaction_uuid !== transactionUuid
  ) {
    throw new PaymentServiceError("Verification mismatch", 400);
  }

  if (
    verifyData.total_amount &&
    parseFloat(String(verifyData.total_amount)) !== expectedAmount
  ) {
    throw new PaymentServiceError("Verified amount mismatch", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await acquireAdvisoryLock(client, `esewa_code:${transactionCode}`);
    await acquireAdvisoryLock(client, `esewa_user:${targetUserId}`);

    const existingPayment = await existsSubscriptionByPaymentRef(
      client,
      transactionCode
    );

    if (existingPayment) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError("Payment already processed", 400);
    }

    const existingTransaction = await existsEsewaTransactionByPaymentRef(
      client,
      transactionCode
    );

    if (existingTransaction) {
      await client.query("ROLLBACK");
      throw new PaymentServiceError("Payment already processed", 400);
    }

    const currentExpiresAt = await selectSubscriptionExpiryByUser(client, targetUserId);
    const expiresAt = calculateExpiryDate(resolvedBilling, currentExpiresAt);

    await upsertActiveProSubscription(client, {
      userId: targetUserId,
      billing: resolvedBilling,
      expiresAt,
      paymentRef: transactionCode,
    });

    await insertCompletedEsewaTransaction(client, {
      userId: targetUserId,
      amount: totalAmount,
      paymentRef: transactionCode,
      metadataJson: JSON.stringify({
        billing: resolvedBilling,
        esewa_transaction_code: transactionCode,
        esewa_transaction_uuid: transactionUuid,
        verified_at: new Date().toISOString(),
        source: "esewa_payment",
      }),
    });

    await client.query("COMMIT");

    return {
      success: true,
      plan: "pro",
      billing: resolvedBilling,
      expires_at: expiresAt,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failure and return original error.
    }

    if (err instanceof PaymentServiceError) {
      throw err;
    }

    throw new PaymentServiceError("Verification failed", 500);
  } finally {
    client.release();
  }
}
