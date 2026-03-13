// decisionEngine.ts

export type Intent =
  | "PRICE"
  | "AVAILABILITY"
  | "DELIVERY"
  | "DELIVERY_CONFIRM"
  | "COD"
  | "DETAILS"
  | "GENERAL"
  | "UNKNOWN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type DecisionAction = "REPLY" | "ASK" | "SKIP";

interface DecisionInput {
  intent: Intent;
  productKnown: boolean;
  confidence: Confidence;
}

interface DecisionOutput {
  action: DecisionAction;
  reason: string;
}

export function decideReply(
  input: DecisionInput
): DecisionOutput {
  const { intent, productKnown, confidence } = input;

  // Rule 1: Unknown intent AND product not known → ask
  // But if product IS known, we can still attempt to reply
  if (intent === "UNKNOWN" && !productKnown) {
    return {
      action: "ASK",
      reason: "Intent not clear and product not identified",
    };
  }

  // Rule 2: Delivery questions don't require product context → always reply
  if (intent === "DELIVERY") {
    return {
      action: "REPLY",
      reason: "Delivery question does not require product context",
    };
  }

  // Rule 2b: Delivery confirmation (customer wants delivery) → always reply
  if (intent === "DELIVERY_CONFIRM") {
    return {
      action: "REPLY",
      reason: "Customer confirmed delivery, ask for details",
    };
  }

  // Rule 2c: COD questions don't require product context → always reply
  if (intent === "COD") {
    return {
      action: "REPLY",
      reason: "COD question does not require product context",
    };
  }

  // Rule 3: General greetings don't require product context → always reply
  if (intent === "GENERAL") {
    return {
      action: "REPLY",
      reason: "General greeting does not require product context",
    };
  }

  // Rule 4: Product not identified → ask
  if (!productKnown) {
    return {
      action: "ASK",
      reason: "Product not identified",
    };
  }

  // Rule 5: Low confidence → ask
  if (confidence === "LOW") {
    return {
      action: "ASK",
      reason: "Low confidence",
    };
  }

  // Rule 6: Safe to reply (product is known, intent is clear or product name gives context)
  return {
    action: "REPLY",
    reason: "Intent and product are clear",
  };
}
