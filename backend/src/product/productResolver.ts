// productResolver.ts

export interface ProductContextInput {
  messageText?: string;
  hasMedia?: boolean; // image / video / screenshot
  source?: "STORY_REPLY" | "REEL_FORWARD" | "DM";
  productNames?: string[]; // List of seller's product names from DB
}

export interface ProductContextResult {
  productKnown: boolean;
  matchedProduct?: string;
  reason: string;
}

/**
 * Check if any product name is mentioned in the message.
 * Uses case-insensitive partial matching.
 */
function findProductInMessage(
  messageText: string,
  productNames: string[]
): string | null {
  const lowerMessage = messageText.toLowerCase();

  for (const productName of productNames) {
    const lowerProductName = productName.toLowerCase();
    // Check if product name appears in message
    if (lowerMessage.includes(lowerProductName)) {
      return productName;
    }
  }

  return null;
}

export function resolveProductContext(
  input: ProductContextInput
): ProductContextResult {
  const { messageText, hasMedia, source, productNames = [] } = input;

  // Rule 1: Reply to story → product known (story contains product context)
  if (source === "STORY_REPLY") {
    return {
      productKnown: true,
      reason: "Story reply contains product context",
    };
  }

  // Rule 2: Forwarded reel → product known (reel contains product context)
  if (source === "REEL_FORWARD") {
    return {
      productKnown: true,
      reason: "Forwarded reel contains product context",
    };
  }

  // Rule 3: Media sent → assume product context (screenshot/image of product)
  if (hasMedia) {
    return {
      productKnown: true,
      reason: "Media provided by user",
    };
  }

  // Rule 4: Check if a SPECIFIC product name is mentioned in the message
  // This is the MVP-critical rule: NO GUESSING, NO DEFAULTS
  if (messageText && productNames.length > 0) {
    const matchedProduct = findProductInMessage(messageText, productNames);
    if (matchedProduct) {
      return {
        productKnown: true,
        matchedProduct,
        reason: `Product "${matchedProduct}" mentioned in text`,
      };
    }
  }

  // DEFAULT: No product context detected → productKnown = false
  // This ensures vague messages like "price please" trigger ASK
  return {
    productKnown: false,
    reason: "No product name detected in message",
  };
}
