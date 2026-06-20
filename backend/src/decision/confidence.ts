// confidence.ts

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type MessageComplexity = "SHORT" | "MEDIUM_OR_COMPLEX";

export interface ConfidenceInput {
  productKnown: boolean;
  intent?: string;
  messageComplexity?: MessageComplexity;
}

function normalizeIntent(intent?: string): string {
  if (!intent || typeof intent !== "string") {
    return "UNKNOWN";
  }

  return intent.toUpperCase();
}

export function calculateConfidence(
  input: ConfidenceInput
): ConfidenceLevel {
  const { productKnown, messageComplexity = "MEDIUM_OR_COMPLEX" } = input;
  const normalizedIntent = normalizeIntent(input.intent);

  const needsProductContext =
    normalizedIntent === "PRICE" ||
    normalizedIntent === "AVAILABILITY" ||
    normalizedIntent === "DETAILS" ||
    normalizedIntent === "UNKNOWN";

  // Product-dependent intents without product context are low confidence.
  if (!productKnown && needsProductContext) {
    return "LOW";
  }

  // Delivery/COD/Greetings can still be handled even when product is unknown.
  if (!productKnown) {
    return "MEDIUM";
  }

  // Unknown intent should not be considered high-confidence.
  if (normalizedIntent === "UNKNOWN") {
    return "LOW";
  }

  // Short messages are frequently ambiguous in seller chat flow.
  if (messageComplexity === "SHORT") {
    return "MEDIUM";
  }

  return "HIGH";
}
