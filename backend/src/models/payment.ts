export type BillingCycle = "monthly" | "yearly";

export interface ParsedEsewaTransactionUuid {
  userId: number | null;
  billing: BillingCycle | null;
}

export interface ManualQrSubmitInput {
  billing: BillingCycle;
  paymentReference: string;
  payerName: string;
  note: string | null;
}

export interface EsewaVerifyInput {
  encodedData: string;
}

export const PLAN_PRICES = {
  pro_monthly: 299,
  pro_yearly: 2499,
} as const;

export const MANUAL_QR_RECEIVER_ID_PLACEHOLDER = "Configure MANUAL_QR_RECEIVER_ID";
