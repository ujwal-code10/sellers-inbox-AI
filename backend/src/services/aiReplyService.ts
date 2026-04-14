import Groq from "groq-sdk";
import pool from "../utils/db.js";
import { SYSTEM_PROMPT } from "../ai/systemprompt.js";
import { resolveProductContext } from "../product/productResolver.js";
import { decideReply } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";
import { incrementReplyCount } from "../middleware/checkPlan.js";
import { SellerIntent, SuggestReplyInput, SuggestReplyResponse } from "../models/ai.js";
import { logAIUsage } from "./aiUsageService.js";

const AI_SELECTION_DEBUG_ENABLED =
  process.env.ENABLE_AI_SELECTION_DEBUG === "true" &&
  process.env.NODE_ENV !== "production";

function logAiSelectionDebug(event: string, details: Record<string, unknown>): void {
  if (!AI_SELECTION_DEBUG_ENABLED) {
    return;
  }

  console.info("[AI_SELECTION_DEBUG][server]", event, details);
}

export class AIServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "AIServiceError";
    this.status = status;
  }
}

function detectIntent(message: string): SellerIntent {
  const lowerMsg = message.toLowerCase();
  const compact = lowerMsg.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const priceSignals = [
    "price",
    "price please",
    "price pls",
    "rate",
    "last price",
    "best price",
    "cost",
    "kati",
    "dam",
    "bhau",
  ];

  if (priceSignals.some((signal) => compact.includes(signal))) {
    return "PRICE";
  }

  if (/\bpp\b/.test(compact) || /\bp\.?p\.?\b/.test(compact)) {
    return "PRICE";
  }

  if (lowerMsg.includes("cod") || lowerMsg.includes("cash on delivery")) {
    return "COD";
  }

  if (
    (lowerMsg.includes("delivery") || lowerMsg.includes("deliver")) &&
    (lowerMsg.match(/\bhunxa\b/) ||
      lowerMsg.match(/\bhuncha\b/) ||
      lowerMsg.includes("garnu"))
  ) {
    return "DELIVERY_CONFIRM";
  }

  if (
    lowerMsg.includes("delivery") ||
    lowerMsg.includes("shipping") ||
    lowerMsg.includes("pathau") ||
    lowerMsg.includes("deliver")
  ) {
    return "DELIVERY";
  }

  if (
    lowerMsg.includes("details") ||
    lowerMsg.includes("detail") ||
    lowerMsg.includes("info") ||
    lowerMsg.includes("information") ||
    lowerMsg.includes("barema") ||
    lowerMsg.includes("bare")
  ) {
    return "DETAILS";
  }

  if (
    lowerMsg.includes("available") ||
    lowerMsg.includes("stock") ||
    lowerMsg.match(/\bxa\b/) ||
    lowerMsg.match(/\bcha\b/) ||
    lowerMsg.includes("pauincha") ||
    lowerMsg.includes("milcha")
  ) {
    return "AVAILABILITY";
  }

  if (
    lowerMsg.match(/\bhi\b/) ||
    lowerMsg.match(/\bhello\b/) ||
    lowerMsg.match(/\bhajur\b/)
  ) {
    return "GENERAL";
  }

  return "UNKNOWN";
}

function buildClarificationPrompt(customerMessage: string): string {
  return `
A customer sent this message to a Nepali Instagram seller: "${customerMessage}"

The message does not clearly identify which product they are asking about.
Generate ONE short clarification reply asking which product they mean.

Rules:
- Reply in the SAME language style as the customer message (Romanized Nepali, English, or mixed).
- NEVER use: bhai, dai, didi, sir, madam.
- NEVER use "Cha hajur".
- Keep it natural and friendly — 1 sentence only.
- Acknowledge what they said if possible (e.g. if they said "red M size", mention it).
- No emoji except 😊 at the end if tone feels right.

Examples:
- "yo cha?" → "Kun product bare sodhnu bhako? Naam ya description dinu hola."
- "red M size cha?" → "Red M size — kun product bare sodhnu bhako? Naam bhannu hola 😊"
- "kati ho?" → "Kun product ko price sodhnu bhako? Naam bhannu hola."
- "available cha?" → "Kun product bare sodhnu bhako? Alik detail dinu hola 😊"

Reply text only. Nothing else.
`;
}

function buildDeliveryContext(deliveryZones: any[]): string {
  if (deliveryZones.length > 0) {
    return `Delivery Zones (use EXACT zone names and prices when customer asks about delivery):
${deliveryZones
  .map((z: any) => `- ${z.name}: Rs. ${z.price} (COD: ${z.cod_available ? "Yes" : "No"})`)
  .join("\n")}

IMPORTANT: Only mention delivery if customer asks. Use the exact zone names above, not generic terms like "valley".`;
  }

  return "No delivery info available. If customer asks about delivery, say \"Delivery charge area anusar lagcha.\"";
}

function hasPriceSignal(message: string): boolean {
  const compact = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return false;
  }

  const priceSignals = [
    "pp",
    "p p",
    "price",
    "price please",
    "price pls",
    "rate",
    "last price",
    "best price",
    "cost",
    "kati",
    "dam",
    "bhau",
  ];

  return priceSignals.some((signal) => compact.includes(signal));
}

function hasAvailabilitySignal(message: string): boolean {
  const lowerMsg = message.toLowerCase();

  return (
    lowerMsg.includes("available") ||
    lowerMsg.includes("stock") ||
    /\bxa\b/.test(lowerMsg) ||
    /\bcha\b/.test(lowerMsg) ||
    lowerMsg.includes("pauincha") ||
    lowerMsg.includes("milcha")
  );
}

function normalizeLookupText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getUniqueVariantValues(variants: any[], key: "color" | "size"): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const variant of variants) {
    const rawValue = String(variant?.[key] ?? "").trim();
    if (!rawValue) {
      continue;
    }

    const normalized = rawValue.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    values.push(rawValue);
  }

  return values;
}

function findMentionedColor(message: string, productVariants: any[]): string | undefined {
  const normalizedMessage = normalizeLookupText(message);
  const colors = getUniqueVariantValues(productVariants, "color").sort(
    (a, b) => b.length - a.length
  );

  return colors.find((color) => {
    const normalizedColor = normalizeLookupText(color);
    return normalizedColor.length > 0 && normalizedMessage.includes(normalizedColor);
  });
}

function findMentionedSize(message: string, productVariants: any[]): string | undefined {
  const normalizedMessage = normalizeLookupText(message);
  const compactMessage = normalizedMessage.replace(/\s+/g, "");
  const sizes = getUniqueVariantValues(productVariants, "size").sort(
    (a, b) => b.length - a.length
  );

  for (const size of sizes) {
    const normalizedSize = normalizeLookupText(size).replace(/\s+/g, "");
    if (!normalizedSize) {
      continue;
    }

    if (normalizedSize.length <= 2 || /^\d+$/.test(normalizedSize)) {
      const wordPattern = new RegExp(
        `(?:^|\\s)${escapeRegExp(normalizedSize)}(?:\\s|$)`
      );
      const sizePattern = new RegExp(
        `${escapeRegExp(normalizedSize)}\\s*size|size\\s*${escapeRegExp(
          normalizedSize
        )}`
      );

      if (wordPattern.test(normalizedMessage) || sizePattern.test(normalizedMessage)) {
        return size;
      }

      continue;
    }

    const normalizedOriginalSize = normalizeLookupText(size);
    if (
      compactMessage.includes(normalizedSize) ||
      (normalizedOriginalSize && normalizedMessage.includes(normalizedOriginalSize))
    ) {
      return size;
    }
  }

  return undefined;
}

function buildForcedFollowUpAvailabilityReply(params: {
  customerMessage: string;
  product: { name: string };
  productVariants: any[];
}): string {
  const { customerMessage, product, productVariants } = params;
  const availableVariants = productVariants.filter((variant) => Boolean(variant.available));

  const requestedColor = findMentionedColor(customerMessage, productVariants);
  const requestedSize = findMentionedSize(customerMessage, productVariants);

  const hasVariantMatch = (variant: any) => {
    const sameColor =
      !requestedColor ||
      String(variant.color).toLowerCase() === requestedColor.toLowerCase();
    const sameSize =
      !requestedSize || String(variant.size).toLowerCase() === requestedSize.toLowerCase();
    return sameColor && sameSize;
  };

  if (requestedColor && requestedSize) {
    const requestedVariant = productVariants.find((variant) => hasVariantMatch(variant));
    if (requestedVariant?.available) {
      return `${requestedColor} ${requestedSize} size ma available cha.`;
    }
    return `${requestedColor} ${requestedSize} size aaile available chaina.`;
  }

  if (requestedColor) {
    const hasAvailableColor = availableVariants.some((variant) => hasVariantMatch(variant));
    return hasAvailableColor
      ? `${requestedColor} color ma available cha.`
      : `${requestedColor} color aaile available chaina.`;
  }

  if (requestedSize) {
    const hasAvailableSize = availableVariants.some((variant) => hasVariantMatch(variant));
    return hasAvailableSize
      ? `${requestedSize} size ma available cha.`
      : `${requestedSize} size aaile available chaina.`;
  }

  if (availableVariants.length > 0) {
    return `${product.name} available cha.`;
  }

  return `${product.name} aaile sold out cha.`;
}

function buildContextMessage(params: {
  customerMessage: string;
  backendIntent: SellerIntent;
  priceAskedInMessage: boolean;
  followUpContext: boolean;
  forcedProductInstruction: string;
  productsForPrompt: any[];
  variants: any[];
  deliveryContext: string;
  includeAliases: boolean;
}): string {
  return `
Customer Message: ${params.customerMessage}

Backend Intent: ${params.backendIntent}
Price asked in this message: ${params.priceAskedInMessage ? "YES" : "NO"}
Conversation Stage: ${params.followUpContext ? "FOLLOW_UP" : "FIRST_MESSAGE"}
Backend Instruction:
- If price asked is NO, do NOT include price in the reply.
- If intent is AVAILABILITY and price asked is NO, reply availability only.
- Include price only when customer explicitly asked for price in the same message.
- If conversation stage is FOLLOW_UP, do NOT use "Cha hajur 😊".
- For follow-up availability questions, answer only what is asked.
- If customer asks only size, do not list all colors.
- If customer asks only color, do not list all sizes.

  ${params.forcedProductInstruction}

Available Products:
  ${params.productsForPrompt
    .map((p: any) => {
      const productVariants = params.variants.filter((v: any) => v.product_id === p.id);
      const aliasSegment =
        params.includeAliases && p.keywords
          ? ` [also known as: ${p.keywords}]`
          : "";

      return `- ${p.name} (Rs. ${p.price})${aliasSegment}
  Variants: ${productVariants
    .map(
      (v: any) => `${v.color} ${v.size} (${v.available ? "Available" : "Out of stock"})`
    )
    .join(", ")}${p.notes ? `\n  Notes: ${p.notes}` : ""}`;
    })
    .join("\n")}

${params.deliveryContext}
`;
}

function formatPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "0";
  }

  if (Number.isInteger(amount)) {
    return String(amount);
  }

  return amount.toFixed(2).replace(/\.00$/, "");
}

function buildForcedPriceReply(product: { name: string; price: unknown }): string {
  return `${product.name} ko price Rs. ${formatPrice(product.price)} ho.`;
}

export async function suggestReplyForUser(params: {
  userId: number;
  input: SuggestReplyInput;
}): Promise<SuggestReplyResponse> {
  const { userId, input } = params;
  const normalizedForcedProduct = input.forcedProduct.trim();
  const normalizedForcedProductId =
    typeof input.forcedProductId === "number" && Number.isInteger(input.forcedProductId)
      ? input.forcedProductId
      : undefined;
  const hasForcedSelection =
    typeof normalizedForcedProductId === "number" || normalizedForcedProduct.length > 0;

  logAiSelectionDebug("request_received", {
    userId,
    hasForcedSelection,
    forcedProductId: normalizedForcedProductId ?? null,
    forcedProductName: normalizedForcedProduct || null,
    followUpContext: input.followUpContext,
    messagePreview: input.customerMessage.slice(0, 120),
    source: input.source,
    hasMedia: input.hasMedia,
    recentProducts: input.recentProducts,
  });

  try {
    const productsRes = await pool.query(
      `SELECT
         p.id,
         p.name,
         p.price::double precision AS price,
         p.keywords,
         p.notes,
         COALESCE(COUNT(v.id), 0)::int AS variant_count,
         COALESCE(COUNT(*) FILTER (WHERE v.available = true), 0)::int AS available_variant_count
       FROM products p
       LEFT JOIN variants v ON v.product_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY available_variant_count DESC, variant_count DESC, p.id DESC`,
      [userId]
    );

    const variantsRes = await pool.query(
      `SELECT v.id, v.product_id, v.color, v.size, v.available
       FROM variants v
       JOIN products p ON p.id = v.product_id
       WHERE p.user_id = $1`,
      [userId]
    );

    const products = productsRes.rows;
    const variants = variantsRes.rows;

    logAiSelectionDebug("context_loaded", {
      userId,
      productCount: products.length,
      variantCount: variants.length,
      topProducts: products.slice(0, 8).map((p: any) => ({
        id: Number(p.id),
        name: p.name,
      })),
    });

    const selectedProduct = hasForcedSelection
      ? products.find((product: any) => {
          if (typeof normalizedForcedProductId === "number") {
            return Number(product.id) === normalizedForcedProductId;
          }

          return (
            String(product.name).toLowerCase() === normalizedForcedProduct.toLowerCase()
          );
        })
      : null;

    logAiSelectionDebug("forced_selection_resolved", {
      userId,
      hasForcedSelection,
      forcedProductId: normalizedForcedProductId ?? null,
      forcedProductName: normalizedForcedProduct || null,
      selectedProductId: selectedProduct ? Number(selectedProduct.id) : null,
      selectedProductName: selectedProduct ? selectedProduct.name : null,
    });

    if (hasForcedSelection && !selectedProduct) {
      logAiSelectionDebug("forced_selection_missing", {
        userId,
        forcedProductId: normalizedForcedProductId ?? null,
        forcedProductName: normalizedForcedProduct || null,
        availableProducts: products.slice(0, 12).map((p: any) => ({
          id: Number(p.id),
          name: p.name,
        })),
      });

      throw new AIServiceError(
        "Selected product could not be found. Please select the product again.",
        400
      );
    }

    let productContext: {
      productKnown: boolean;
      matchedProduct?: string;
      candidateProducts?: string[];
    };

    if (selectedProduct) {
      productContext = {
        productKnown: true,
        matchedProduct: selectedProduct.name,
        candidateProducts: [selectedProduct.name],
      };
    } else {
      productContext = resolveProductContext({
        messageText: input.customerMessage,
        hasMedia: input.hasMedia,
        source: input.source,
        products: products.map((p: any) => ({
          name: p.name,
          keywords: p.keywords ?? null,
          availableVariantCount: Number(p.available_variant_count || 0),
          variantCount: Number(p.variant_count || 0),
        })),
        recentProductNames: input.recentProducts,
      });
    }

    const intent = detectIntent(input.customerMessage);
    const priceAskedInMessage = hasPriceSignal(input.customerMessage);

    const confidence = calculateConfidence({
      productKnown: productContext.productKnown,
      intent,
    });

    const decision = decideReply({
      intent,
      productKnown: productContext.productKnown,
      confidence,
    });

    const finalDecision = selectedProduct
      ? {
          action: "REPLY" as const,
          reason: "Seller selected product manually",
        }
      : decision;

    logAiSelectionDebug("decision_ready", {
      userId,
      action: finalDecision.action,
      reason: finalDecision.reason,
      intent,
      priceAskedInMessage,
      followUpContext: input.followUpContext,
      productKnown: productContext.productKnown,
      matchedProduct: productContext.matchedProduct ?? null,
      candidates: productContext.candidateProducts || [],
    });

    if (finalDecision.action === "ASK") {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const clarification = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: buildClarificationPrompt(input.customerMessage) }],
        temperature: 0.3,
        max_tokens: 80,
      });

      const clarificationReply =
        clarification.choices[0]?.message.content?.trim() ||
        "Kun product bare sodhnu bhako? Naam ya description dinu hola.";

      const clarUsage = clarification.usage;
      await logAIUsage({
        userId,
        requestType: "clarification",
        inputTokens: clarUsage?.prompt_tokens || 0,
        outputTokens: clarUsage?.completion_tokens || 0,
        latencyMs: 0,
        status: "success",
      });

      return {
        suggestions: [clarificationReply],
        decision: {
          action: "ASK",
          reason: finalDecision.reason,
          productKnown: productContext.productKnown,
          intent,
          productCandidates: productContext.candidateProducts || [],
        },
      };
    }

    const isPriceOnlyMessage =
      intent === "PRICE" && !hasAvailabilitySignal(input.customerMessage);

    if (selectedProduct && isPriceOnlyMessage) {
      const directReply = buildForcedPriceReply(selectedProduct);

      logAiSelectionDebug("forced_price_reply", {
        userId,
        selectedProductId: Number(selectedProduct.id),
        selectedProductName: selectedProduct.name,
        replyPreview: directReply,
      });

      await incrementReplyCount(userId);
      await logAIUsage({
        userId,
        requestType: "suggest_reply",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "success",
      });

      return {
        suggestions: [directReply],
        decision: {
          action: "REPLY",
          reason: finalDecision.reason,
          productKnown: true,
          matchedProduct: selectedProduct.name,
          intent,
          productCandidates: [selectedProduct.name],
        },
      };
    }

    if (selectedProduct && input.followUpContext && intent === "AVAILABILITY") {
      const selectedProductVariants = variants.filter(
        (variant: any) => Number(variant.product_id) === Number(selectedProduct.id)
      );

      const directReply = buildForcedFollowUpAvailabilityReply({
        customerMessage: input.customerMessage,
        product: selectedProduct,
        productVariants: selectedProductVariants,
      });

      logAiSelectionDebug("forced_followup_availability_reply", {
        userId,
        selectedProductId: Number(selectedProduct.id),
        selectedProductName: selectedProduct.name,
        replyPreview: directReply,
      });

      await incrementReplyCount(userId);
      await logAIUsage({
        userId,
        requestType: "suggest_reply",
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        status: "success",
      });

      return {
        suggestions: [directReply],
        decision: {
          action: "REPLY",
          reason: `${finalDecision.reason} (follow-up availability concise rule)`,
          productKnown: true,
          matchedProduct: selectedProduct.name,
          intent,
          productCandidates: [selectedProduct.name],
        },
      };
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const zonesRes = await pool.query(
      `SELECT id, name, price::double precision AS price, cod_available
       FROM delivery_zones
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    const deliveryContext = buildDeliveryContext(zonesRes.rows);

    const productsForPrompt = selectedProduct ? [selectedProduct] : products;
    const forcedProductInstruction = selectedProduct
      ? `
  Selected Product (seller-confirmed): ${productContext.matchedProduct}
  IMPORTANT:
  - Use this exact product name in your reply: ${productContext.matchedProduct}
  - Seller already selected the product manually.
  - Do NOT ask which product the customer means.
  - Answer for this selected product only.
  - Do NOT switch to alias/category names unless customer used the same wording.
  `
      : "";

    logAiSelectionDebug("prompt_scope", {
      userId,
      forcedSelectionUsed: Boolean(selectedProduct),
      promptProductCount: productsForPrompt.length,
      promptProducts: productsForPrompt.slice(0, 8).map((p: any) => ({
        id: Number(p.id),
        name: p.name,
      })),
    });

    const contextMessage = buildContextMessage({
      customerMessage: input.customerMessage,
      backendIntent: intent,
      priceAskedInMessage,
      followUpContext: input.followUpContext,
      forcedProductInstruction,
      productsForPrompt,
      variants,
      deliveryContext,
      includeAliases: !selectedProduct,
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      temperature: 0.3,
    });

    const suggestions = [completion.choices[0]?.message.content || ""];

    await incrementReplyCount(userId);

    const usage = completion.usage;
    await logAIUsage({
      userId,
      requestType: "suggest_reply",
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      latencyMs: 0,
      status: "success",
    });

    return {
      suggestions,
      decision: {
        action: "REPLY",
        reason: finalDecision.reason,
        productKnown: productContext.productKnown,
        matchedProduct: productContext.matchedProduct,
        intent,
        productCandidates: productContext.candidateProducts || [],
      },
    };
  } catch (err: any) {
    logAiSelectionDebug("request_failed", {
      userId,
      errorName: err?.name || "UnknownError",
      errorMessage: err?.message || "Unknown error",
      status: typeof err?.status === "number" ? err.status : null,
    });

    console.error("AI suggest-reply error:", err);

    await logAIUsage({
      userId,
      requestType: "suggest_reply",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      status: "failed",
      errorMessage: err?.message || "Unknown error",
    });

    if (err?.status === 429) {
      throw new AIServiceError(
        "AI service temporarily unavailable. Please try again later.",
        503
      );
    }

    if (err?.status === 401) {
      throw new AIServiceError(
        "AI service configuration error. Please contact support.",
        503
      );
    }

    if (err instanceof AIServiceError) {
      throw err;
    }

    throw new AIServiceError("Server error", 500);
  }
}
