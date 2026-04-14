export type MessageSource = "STORY_REPLY" | "REEL_FORWARD" | "DM";

export type SellerIntent =
  | "PRICE"
  | "AVAILABILITY"
  | "DELIVERY"
  | "DELIVERY_CONFIRM"
  | "COD"
  | "DETAILS"
  | "GENERAL"
  | "UNKNOWN";

export interface SuggestReplyInput {
  customerMessage: string;
  tone?: string;
  forcedProduct: string;
  forcedProductId?: number;
  followUpContext: boolean;
  source: MessageSource;
  hasMedia: boolean;
  recentProducts: string[];
}

export interface SuggestReplyDecision {
  action: "ASK" | "REPLY";
  reason: string;
  productKnown: boolean;
  matchedProduct?: string;
  intent: SellerIntent;
  productCandidates: string[];
}

export interface SuggestReplyResponse {
  suggestions: string[];
  decision: SuggestReplyDecision;
}
