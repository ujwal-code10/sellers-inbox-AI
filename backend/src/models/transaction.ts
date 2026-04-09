export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";

export interface TransactionModel {
  id: number;
  user_id: number;
  type: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  payment_method?: string | null;
  payment_ref?: string | null;
  metadata?: unknown;
  created_at?: string;
}
