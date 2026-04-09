import Groq from "groq-sdk";
import pool from "../utils/db.js";
import { SYSTEM_PROMPT } from "../ai/systemprompt.js";
import { resolveProductContext } from "../product/productResolver.js";
import { decideReply } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";
import { incrementReplyCount } from "../middleware/checkPlan.js";
import { SellerIntent, SuggestReplyInput, SuggestReplyResponse } from "../models/ai.js";
import { logAIUsage } from "./aiUsageService.js";

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

function buildContextMessage(params: {
  customerMessage: string;
  forcedProductInstruction: string;
  productsForPrompt: any[];
  variants: any[];
  deliveryContext: string;
}): string {
  return `
Customer Message: ${params.customerMessage}

  ${params.forcedProductInstruction}

Available Products:
  ${params.productsForPrompt
    .map((p: any) => {
      const productVariants = params.variants.filter((v: any) => v.product_id === p.id);
      return `- ${p.name} (Rs. ${p.price})${p.keywords ? ` [also known as: ${p.keywords}]` : ""}
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

export async function suggestReplyForUser(params: {
  userId: number;
  input: SuggestReplyInput;
}): Promise<SuggestReplyResponse> {
  const { userId, input } = params;
  const normalizedForcedProduct = input.forcedProduct;

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
    const selectedProduct = normalizedForcedProduct
      ? products.find(
          (product: any) =>
            String(product.name).toLowerCase() === normalizedForcedProduct.toLowerCase()
        )
      : null;

    let productContext: {
      productKnown: boolean;
      matchedProduct?: string;
      candidateProducts?: string[];
    };

    if (normalizedForcedProduct) {
      productContext = {
        productKnown: true,
        matchedProduct: selectedProduct?.name || normalizedForcedProduct,
        candidateProducts: [selectedProduct?.name || normalizedForcedProduct],
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

    const confidence = calculateConfidence({
      productKnown: productContext.productKnown,
      intent,
    });

    const decision = decideReply({
      intent,
      productKnown: productContext.productKnown,
      confidence,
    });

    const finalDecision = normalizedForcedProduct
      ? {
          action: "REPLY" as const,
          reason: "Seller selected product manually",
        }
      : decision;

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
    const forcedProductInstruction = normalizedForcedProduct
      ? `
  Selected Product (seller-confirmed): ${productContext.matchedProduct}
  IMPORTANT:
  - Seller already selected the product manually.
  - Do NOT ask which product the customer means.
  - Answer for this selected product only.
  `
      : "";

    const contextMessage = buildContextMessage({
      customerMessage: input.customerMessage,
      forcedProductInstruction,
      productsForPrompt,
      variants,
      deliveryContext,
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
