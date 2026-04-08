// productResolver.ts

interface ProductContextInput {
  messageText: string;
  hasMedia: boolean;
  source: "STORY_REPLY" | "REEL_FORWARD" | "DM";
  products?: {
    name: string;
    keywords?: string | null;
    availableVariantCount?: number;
    variantCount?: number;
  }[];
  recentProductNames?: string[];
}

interface ProductContextResult {
  productKnown: boolean;
  matchedProduct?: string;
  candidateProducts?: string[];
  reason: string;
}

interface RankedCandidate {
  name: string;
  score: number;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function findProductInMessage(
  messageText: string,
  products: {
    name: string;
    keywords?: string | null;
    availableVariantCount?: number;
    variantCount?: number;
  }[]
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

function buildCandidateProducts(
  messageText: string,
  products: {
    name: string;
    keywords?: string | null;
    availableVariantCount?: number;
    variantCount?: number;
  }[],
  recentProductNames: string[]
): string[] {
  if (products.length === 0) {
    return [];
  }

  const productByLowerName = new Map<
    string,
    {
      name: string;
      keywords?: string | null;
      availableVariantCount?: number;
      variantCount?: number;
    }
  >();
  for (const product of products) {
    productByLowerName.set(product.name.toLowerCase(), product);
  }

  const ranked: RankedCandidate[] = [];
  const messageLower = messageText.toLowerCase();
  const messageTokens = tokenize(messageText);

  for (const product of products) {
    const nameLower = product.name.toLowerCase();
    const nameTokens = tokenize(product.name);
    const keywordTokens = product.keywords
      ? tokenize(product.keywords.replace(/,/g, " "))
      : [];
    const availableVariantCount = product.availableVariantCount ?? 0;
    const variantCount = product.variantCount ?? 0;

    let score = 0;

    // Cold-start quality signal: prioritize items that are ready to sell now.
    if (availableVariantCount > 0) {
      score += 5;
    }

    if (variantCount > 0) {
      score += 2;
    }

    if (keywordTokens.length > 0) {
      score += 1;
    }

    if (messageLower.includes(nameLower)) {
      score += 12;
    }

    for (const token of messageTokens) {
      if (nameTokens.includes(token)) {
        score += 5;
      }
      if (keywordTokens.includes(token)) {
        score += 3;
      }
      if (token.length >= 3 && nameLower.includes(token)) {
        score += 2;
      }
    }

    ranked.push({ name: product.name, score });
  }

  ranked.sort((a, b) => b.score - a.score);

  const topByScore = ranked.slice(0, 5).map((entry) => entry.name);

  const validRecent = recentProductNames
    .map((name) => name.trim())
    .filter((name) => {
      const lower = name.toLowerCase();
      return lower.length > 0 && productByLowerName.has(lower);
    })
    .map((name) => productByLowerName.get(name.toLowerCase())!.name)
    .slice(0, 3);

  const fallback = products
    .slice(0, 5)
    .map((product) => product.name);

  const merged = unique([...topByScore, ...validRecent, ...fallback]);
  return merged.slice(0, 5);
}

export function resolveProductContext(
  input: ProductContextInput
): ProductContextResult {
  const {
    messageText,
    hasMedia,
    source,
    products = [],
    recentProductNames = [],
  } = input;

  const candidateProducts = buildCandidateProducts(
    messageText,
    products,
    recentProductNames
  );

  // Rule 1: Story reply → product known (future Meta API)
  if (source === "STORY_REPLY") {
    return {
      productKnown: true,
      matchedProduct: candidateProducts[0],
      candidateProducts,
      reason: "Story reply contains product context",
    };
  }

  // Rule 2: Forwarded reel → product known (future Meta API)
  if (source === "REEL_FORWARD") {
    return {
      productKnown: true,
      matchedProduct: candidateProducts[0],
      candidateProducts,
      reason: "Forwarded reel contains product context",
    };
  }

  // Rule 3: Media sent → assume product context
  if (hasMedia) {
    return {
      productKnown: true,
      matchedProduct: candidateProducts[0],
      candidateProducts,
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
        candidateProducts,
        reason: `Product "${matchedProduct}" matched in message`,
      };
    }
  }

  // Default: no product identified
  return {
    productKnown: false,
    candidateProducts,
    reason: "No product name or keyword detected in message",
  };
}