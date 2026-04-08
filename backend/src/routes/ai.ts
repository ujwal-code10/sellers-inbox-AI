import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "../ai/systemprompt.js";
import { resolveProductContext } from "../product/productResolver.js";
import { decideReply } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";
import { checkReplyLimit, incrementReplyCount } from "../middleware/checkPlan.js";

const router = express.Router();

/**
 * Log AI usage to ai_usage_logs table
 * Non-blocking: errors are logged but don't break the main request
 */
async function logAIUsage(params: {
  userId: number;
  requestType: "suggest_reply" | "clarification";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs
       (user_id, request_type, model, input_tokens, output_tokens, latency_ms, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        params.userId,
        params.requestType,
        "llama-3.3-70b-versatile",
        params.inputTokens,
        params.outputTokens,
        params.latencyMs,
        params.status,
        params.errorMessage || null,
      ]
    );
  } catch (err) {
    console.error("Failed to log AI usage:", err);
    // Don't throw - AI logging should not break the main operation
  }
}

function detectIntent(message: string): "PRICE" | "AVAILABILITY" | "DELIVERY" | "DELIVERY_CONFIRM" | "COD" | "DETAILS" | "GENERAL" | "UNKNOWN" {
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

  if ((lowerMsg.includes("delivery") || lowerMsg.includes("deliver")) &&
    (lowerMsg.match(/\bhunxa\b/) || lowerMsg.match(/\bhuncha\b/) || lowerMsg.includes("garnu"))) {
    return "DELIVERY_CONFIRM";
  }

  if (lowerMsg.includes("delivery") || lowerMsg.includes("shipping") || lowerMsg.includes("pathau") || lowerMsg.includes("deliver")) {
    return "DELIVERY";
  }

  if (lowerMsg.includes("details") || lowerMsg.includes("detail") || lowerMsg.includes("info") || lowerMsg.includes("information") || lowerMsg.includes("barema") || lowerMsg.includes("bare")) {
    return "DETAILS";
  }

  if (lowerMsg.includes("available") || lowerMsg.includes("stock") ||
    lowerMsg.match(/\bxa\b/) || lowerMsg.match(/\bcha\b/) ||
    lowerMsg.includes("pauincha") || lowerMsg.includes("milcha")) {
    return "AVAILABILITY";
  }

  if (lowerMsg.match(/\bhi\b/) || lowerMsg.match(/\bhello\b/) || lowerMsg.match(/\bhajur\b/)) {
    return "GENERAL";
  }

  return "UNKNOWN";
}

router.post("/ai/suggest-reply", auth, checkReplyLimit, async (req: AuthRequest, res) => {
  const { customerMessage, tone, forcedProduct, source, hasMedia, recentProducts } = req.body;
  const normalizedForcedProduct =
    typeof forcedProduct === "string" ? forcedProduct.trim() : "";

  if (!customerMessage) {
    return res.status(400).json({ error: "customerMessage required" });
  }

  // Validate message length to prevent AI credit waste
  if (typeof customerMessage !== 'string' || customerMessage.length > 2000) {
    return res.status(400).json({ error: "customerMessage must be 1-2000 characters" });
  }

  // Validate tone if provided
  if (tone && !['friendly', 'professional', 'persuasive'].includes(tone.toLowerCase())) {
    return res.status(400).json({ error: "tone must be friendly, professional, or persuasive" });
  }

  // Validate forcedProduct if provided
  if (forcedProduct && (typeof forcedProduct !== 'string' || forcedProduct.trim().length === 0)) {
    return res.status(400).json({ error: "forcedProduct must be a valid product name" });
  }

  if (recentProducts && !Array.isArray(recentProducts)) {
    return res.status(400).json({ error: "recentProducts must be an array of product names" });
  }

  const safeRecentProducts = Array.isArray(recentProducts)
    ? recentProducts
      .filter((item: unknown): item is string => typeof item === "string")
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0)
      .slice(0, 10)
    : [];

  const normalizedSource: "STORY_REPLY" | "REEL_FORWARD" | "DM" =
    source === "STORY_REPLY" || source === "REEL_FORWARD" || source === "DM"
      ? source
      : "DM";

  const normalizedHasMedia = Boolean(hasMedia);

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
      [req.userId]
    );

    const variantsRes = await pool.query(
      `SELECT v.id, v.product_id, v.color, v.size, v.available
       FROM variants v
       JOIN products p ON p.id = v.product_id
       WHERE p.user_id = $1`,
      [req.userId]
    );

    const products = productsRes.rows;
    const variants = variantsRes.rows;
    const selectedProduct = normalizedForcedProduct
      ? products.find(
          (product: any) =>
            String(product.name).toLowerCase() ===
            normalizedForcedProduct.toLowerCase()
        )
      : null;

    let productContext;

    // If forcedProduct is provided, skip product resolution and use it directly
    if (normalizedForcedProduct) {
      productContext = {
        productKnown: true,
        matchedProduct: selectedProduct?.name || normalizedForcedProduct,
        candidateProducts: [selectedProduct?.name || normalizedForcedProduct],
      };
    } else {
      // Normal product resolution flow
      productContext = resolveProductContext({
        messageText: customerMessage,
        hasMedia: normalizedHasMedia,
        source: normalizedSource,
        products: products.map((p: any) => ({
          name: p.name,
          keywords: p.keywords ?? null,
          availableVariantCount: Number(p.available_variant_count || 0),
          variantCount: Number(p.variant_count || 0),
        })),
        recentProductNames: safeRecentProducts,
      });
    }

    const intent = detectIntent(customerMessage);

    const confidence = calculateConfidence({
      productKnown: productContext.productKnown,
      intent,
    });

    const decision = decideReply({
      intent,
      productKnown: productContext.productKnown,
      confidence,
    });

    // Seller manually selected a product, so clarification should never be returned.
    const finalDecision = normalizedForcedProduct
      ? {
          action: "REPLY" as const,
          reason: "Seller selected product manually",
        }
      : decision;

    // If ASK → generate smart clarification (only if no forcedProduct)
    if (finalDecision.action === "ASK") {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const clarificationPrompt = `
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

      const clarification = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: clarificationPrompt }],
        temperature: 0.3,
        max_tokens: 80,
      });

      const clarificationReply =
        clarification.choices[0]?.message.content?.trim() ||
        "Kun product bare sodhnu bhako? Naam ya description dinu hola.";

      // Log clarification request (non-blocking)
      const clarUsage = clarification.usage;
      await logAIUsage({
        userId: req.userId!,
        requestType: "clarification",
        inputTokens: clarUsage?.prompt_tokens || 0,
        outputTokens: clarUsage?.completion_tokens || 0,
        latencyMs: 0,
        status: "success",
      });

      return res.json({
        suggestions: [clarificationReply],
        decision: {
          action: "ASK",
          reason: finalDecision.reason,
          productKnown: productContext.productKnown,
          intent,
          productCandidates: productContext.candidateProducts || [],
        },
      });
    }

    // If REPLY or if forcedProduct provided → generate AI suggestion
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const zonesRes = await pool.query(
      `SELECT id, name, price::double precision AS price, cod_available
       FROM delivery_zones
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId]
    );

    const deliveryZones = zonesRes.rows;

    let deliveryContext = '';
    if (deliveryZones.length > 0) {
      deliveryContext = `Delivery Zones (use EXACT zone names and prices when customer asks about delivery):
${deliveryZones.map((z: any) => `- ${z.name}: Rs. ${z.price} (COD: ${z.cod_available ? 'Yes' : 'No'})`).join('\n')}

IMPORTANT: Only mention delivery if customer asks. Use the exact zone names above, not generic terms like "valley".`;
    } else {
      deliveryContext = 'No delivery info available. If customer asks about delivery, say "Delivery charge area anusar lagcha."';
    }

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

    const contextMessage = `
Customer Message: ${customerMessage}

  ${forcedProductInstruction}

Available Products:
  ${productsForPrompt.map((p: any) => {
      const productVariants = variants.filter((v: any) => v.product_id === p.id);
      return `- ${p.name} (Rs. ${p.price})${p.keywords ? ` [also known as: ${p.keywords}]` : ''}
  Variants: ${productVariants.map((v: any) => `${v.color} ${v.size} (${v.available ? 'Available' : 'Out of stock'})`).join(', ')}${p.notes ? `\n  Notes: ${p.notes}` : ''}`;
    }).join('\n')}

${deliveryContext}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      temperature: 0.3,
    });

    const suggestions = [completion.choices[0]?.message.content || ""];

    await incrementReplyCount(req.userId!);

    // Log AI usage (non-blocking)
    const usage = completion.usage;
    await logAIUsage({
      userId: req.userId!,
      requestType: "suggest_reply",
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      latencyMs: 0, // Groq SDK doesn't expose latency, would need to measure manually if needed
      status: "success",
    });

    res.json({
      suggestions,
      decision: {
        action: "REPLY",
        reason: finalDecision.reason,
        productKnown: productContext.productKnown,
        matchedProduct: productContext.matchedProduct,
        intent,
        productCandidates: productContext.candidateProducts || [],
      },
    });
  } catch (err: any) {
    console.error("AI suggest-reply error:", err);

    // Log failed AI request (non-blocking)
    await logAIUsage({
      userId: req.userId!,
      requestType: "suggest_reply",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      status: "failed",
      errorMessage: err?.message || "Unknown error",
    });

    if (err?.status === 429) {
      return res.status(503).json({
        error: "AI service temporarily unavailable. Please try again later."
      });
    }

    if (err?.status === 401) {
      return res.status(503).json({
        error: "AI service configuration error. Please contact support."
      });
    }

    res.status(500).json({ error: "Server error" });
  }
});

export default router;