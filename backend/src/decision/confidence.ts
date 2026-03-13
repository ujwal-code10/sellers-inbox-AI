// confidence.ts

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceInput {
  productKnown: boolean;
  intent?: string;
}

export function calculateConfidence(
  input: ConfidenceInput
): ConfidenceLevel {
  const { productKnown, intent } = input;

  // Rule 1: product unknown → low confidence
  if (!productKnown) return "LOW";

  // Rule 2: intent clearly recognized → high confidence
  if (intent && intent.length > 0) return "HIGH";

  // Rule 3: fallback → medium confidence
  return "MEDIUM";
}
