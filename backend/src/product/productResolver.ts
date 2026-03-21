// productResolver.ts

interface ProductContextInput {
  messageText: string;
  hasMedia: boolean;
  source: "STORY_REPLY" | "REEL_FORWARD" | "DM";
  products?: { name: string; keywords?: string | null }[];
}

interface ProductContextResult {
  productKnown: boolean;
  matchedProduct?: string;
  reason: string;
}

function findProductInMessage(
  messageText: string,
  products: { name: string; keywords?: string | null }[]
): string | null {
  const msgLower = messageText.toLowerCase();

  for (const product of products) {
    const nameLower = product.name.toLowerCase();

    // Check product name first — strongest signal
    if (msgLower.includes(nameLower)) {
      return product.name;
    }

    // Check keywords if provided
    if (product.keywords) {
      const keywordList = product.keywords
        .split(",")
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 1);

      for (const keyword of keywordList) {
        if (msgLower.includes(keyword)) {
          return product.name;
        }
      }
    }
  }

  return null;
}

export function resolveProductContext(
  input: ProductContextInput
): ProductContextResult {
  const { messageText, hasMedia, source, products = [] } = input;

  // Rule 1: Story reply → product known (future Meta API)
  if (source === "STORY_REPLY") {
    return {
      productKnown: true,
      reason: "Story reply contains product context",
    };
  }

  // Rule 2: Forwarded reel → product known (future Meta API)
  if (source === "REEL_FORWARD") {
    return {
      productKnown: true,
      reason: "Forwarded reel contains product context",
    };
  }

  // Rule 3: Media sent → assume product context
  if (hasMedia) {
    return {
      productKnown: true,
      reason: "Media provided by user",
    };
  }

  // Rule 4: Match product name OR keywords in message
  if (messageText && products.length > 0) {
    const matchedProduct = findProductInMessage(messageText, products);
    if (matchedProduct) {
      return {
        productKnown: true,
        matchedProduct,
        reason: `Product "${matchedProduct}" matched in message`,
      };
    }
  }

  // Default: no product identified
  return {
    productKnown: false,
    reason: "No product name or keyword detected in message",
  };
}