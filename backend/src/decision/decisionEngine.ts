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
export type MessageComplexity = "SHORT" | "MEDIUM_OR_COMPLEX";

export type DecisionAction = "REPLY" | "ASK" | "SKIP";

interface DecisionInput {
  intent: Intent;
  productKnown: boolean;
  confidence: Confidence;
  messageComplexity?: MessageComplexity;
}

interface DecisionOutput {
  action: DecisionAction;
  reason: string;
}

export function decideReply(
  input: DecisionInput
): DecisionOutput {
  const {
    intent,
    productKnown,
    confidence,
    messageComplexity = "MEDIUM_OR_COMPLEX",
  } = input;

  // Unknown intent with unknown product needs clarification first.
  if (intent === "UNKNOWN" && !productKnown) {
    return {
      action: "ASK",
      reason: "Intent not clear and product not identified",
    };
  }

  // Delivery/COD/Greetings can reply without product context.
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

  // Greetings can stay lightweight.
  if (intent === "GENERAL") {
    return {
      action: "REPLY",
      reason: "General greeting does not require product context",
    };
  }

  // Product-dependent replies require known product.
  if (!productKnown) {
    return {
      action: "ASK",
      reason: "Product not identified",
    };
  }

  // Low confidence should ask before risking a wrong reply.
  if (confidence === "LOW") {
    return {
      action: "ASK",
      reason: "Low confidence",
    };
  }

  // Short seller-chat messages should stay concise and direct.
  if (
    messageComplexity === "SHORT" &&
    (intent === "PRICE" || intent === "AVAILABILITY" || intent === "DETAILS")
  ) {
    return {
      action: "REPLY",
      reason: "Short message; concise direct reply preferred",
    };
  }

  return {
    action: "REPLY",
    reason: "Intent and product are clear",
  };
}
