import {
  BillingCycle,
  EsewaVerifyInput,
  ManualQrSubmitInput,
} from "../models/payment.js";

export class PaymentSchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "PaymentSchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseBillingCycle(value: unknown): BillingCycle | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  return null;
}

export function normalizeManualReference(reference: string): string {
  return reference.trim().toUpperCase();
}

export function parseManualQrSubmitBody(body: unknown): ManualQrSubmitInput {
  if (!isRecord(body)) {
    throw new PaymentSchemaError("Invalid request body");
  }

  const parsedBilling = parseBillingCycle(body.billing);
  if (!parsedBilling) {
    throw new PaymentSchemaError("billing must be monthly or yearly");
  }

  if (typeof body.paymentReference !== "string") {
    throw new PaymentSchemaError("paymentReference is required");
  }

  const cleanedReference = normalizeManualReference(body.paymentReference);
  if (cleanedReference.length < 4 || cleanedReference.length > 80) {
    throw new PaymentSchemaError("paymentReference must be 4-80 characters");
  }

  if (!/^[a-zA-Z0-9/_-]+$/.test(cleanedReference)) {
    throw new PaymentSchemaError(
      "paymentReference can only contain letters, numbers, slash, underscore, or dash"
    );
  }

  if (typeof body.payerName !== "string" || body.payerName.trim().length < 2) {
    throw new PaymentSchemaError("payerName is required for verification");
  }

  const cleanedPayerName = body.payerName.trim().slice(0, 120);

  const cleanedNote =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 300)
      : null;

  return {
    billing: parsedBilling,
    paymentReference: cleanedReference,
    payerName: cleanedPayerName,
    note: cleanedNote,
  };
}

export function parseEsewaVerifyBody(body: unknown): EsewaVerifyInput {
  if (!isRecord(body)) {
    throw new PaymentSchemaError("Invalid request body");
  }

  if (typeof body.encodedData !== "string" || body.encodedData.trim().length === 0) {
    throw new PaymentSchemaError("encodedData is required");
  }

  return {
    encodedData: body.encodedData,
    billing: parseBillingCycle(body.billing),
  };
}
