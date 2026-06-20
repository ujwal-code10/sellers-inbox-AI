import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { getRequestId } from "../utils/requestContext.js";
import {
  parseBillingCycle,
  parseEsewaVerifyBody,
  parseManualQrSubmitBody,
  PaymentSchemaError,
} from "../schemas/paymentSchemas.js";
import {
  createEsewaInitiation,
  getManualQrPublicConfig,
  getPendingManualQrStatus,
  getPlansOverview,
  isEsewaConfigured,
  isManualQrConfigured,
  PaymentServiceError,
  submitManualQrPayment,
  verifyEsewaPayment,
} from "../services/paymentService.js";

function handlePaymentError(
  req: Request,
  res: Response,
  err: unknown,
  fallbackMessage: string,
  logPrefix: string
): Response {
  if (err instanceof PaymentSchemaError || err instanceof PaymentServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  const requestId = getRequestId(req);
  console.error(logPrefix, { requestId, err });
  return res.status(500).json({ error: fallbackMessage, requestId });
}

function getAuthedUserId(req: AuthRequest): number | null {
  if (typeof req.userId !== "number") {
    return null;
  }

  return req.userId;
}

export async function getPlansHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getPlansOverview(userId);
    return res.json(data);
  } catch (err) {
    return handlePaymentError(req, res, err, "Server error", "Payment plans error:");
  }
}

export function getManualQrConfigHandler(_req: AuthRequest, res: Response) {
  return res.json(getManualQrPublicConfig());
}

export async function getManualQrStatusHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const data = await getPendingManualQrStatus(userId);
    return res.json(data);
  } catch (err) {
    return handlePaymentError(
      req,
      res,
      err,
      "Could not load payment status",
      "Manual QR status error:"
    );
  }
}

export async function submitManualQrHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isManualQrConfigured()) {
    return res.status(503).json({
      error:
        "Manual QR payments are not configured yet on the server. Please contact support.",
    });
  }

  try {
    const parsedBody = parseManualQrSubmitBody(req.body);
    const result = await submitManualQrPayment({ userId, input: parsedBody });
    return res.status(201).json(result);
  } catch (err) {
    return handlePaymentError(
      req,
      res,
      err,
      "Could not submit payment",
      "Manual QR submit error:"
    );
  }
}

export function initiateEsewaHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isEsewaConfigured()) {
    return res.status(503).json({
      error: "eSewa is not configured on the server.",
    });
  }

  const parsedBilling = parseBillingCycle(req.body?.billing);
  if (!parsedBilling) {
    return res.status(400).json({ error: "billing must be monthly or yearly" });
  }

  try {
    const data = createEsewaInitiation({
      userId,
      billing: parsedBilling,
      frontendUrl: process.env.FRONTEND_URL,
    });

    return res.json(data);
  } catch (err) {
    return handlePaymentError(
      req,
      res,
      err,
      "Could not initiate eSewa payment",
      "eSewa initiation error:"
    );
  }
}

export async function verifyEsewaHandler(req: Request, res: Response) {
  if (!isEsewaConfigured()) {
    return res.status(503).json({
      error: "eSewa is not configured on the server.",
    });
  }

  try {
    // SOURCE: eSewa redirect sends encoded transaction payload to this endpoint.
    // RISK: accepting malformed payloads can bypass verification or trigger invalid upgrades.
    // PROTECTION: parse and normalize body first, then delegate to service-level signature/provider checks.
    // RESULT: only verified payments can activate plan upgrades.
    const parsedBody = parseEsewaVerifyBody(req.body);
    const result = await verifyEsewaPayment(parsedBody);
    return res.json(result);
  } catch (err) {
    return handlePaymentError(
      req,
      res,
      err,
      "Verification failed",
      "eSewa verify error:"
    );
  }
}
