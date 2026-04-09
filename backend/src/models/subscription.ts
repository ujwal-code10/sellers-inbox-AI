export type PlanType = "free" | "pro";
export type BillingType = "monthly" | "yearly" | null;
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "pending";

export interface SubscriptionModel {
  id: number;
  user_id: number;
  plan: PlanType;
  billing: BillingType;
  status: SubscriptionStatus;
  started_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
}
