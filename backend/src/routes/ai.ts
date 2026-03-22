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

function detectIntent(message: string): "PRICE" | "AVAILABILITY" | "DELIVERY" | "DELIVERY_CONFIRM" | "COD" | "DETAILS" | "GENERAL" | "UNKNOWN" {
  const lowerMsg = message.toLowerCase();

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

  if (lowerMsg.includes("price") || lowerMsg.includes("kati") || lowerMsg.includes("cost")) {
    return "PRICE";
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
  const { customerMessage, tone } = req.body;

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

  try {
    const productsRes = await pool.query(
      `SELECT id, name, price, keywords, notes FROM products WHERE user_id = $1`,
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

    const productContext = resolveProductContext({
      messageText: customerMessage,
      hasMedia: false,
      source: "DM",
      products: products.map((p: any) => ({
        name: p.name,
        keywords: p.keywords ?? null,
      })),
    });

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

    // If ASK → generate smart clarification
    if (decision.action === "ASK") {
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

      return res.json({
        suggestions: [clarificationReply],
        decision: {
          action: "ASK",
          reason: decision.reason,
          productKnown: productContext.productKnown,
          intent,
        },
      });
    }

    // If REPLY → generate AI suggestion
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const zonesRes = await pool.query(
      `SELECT id, name, price, cod_available
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

    const contextMessage = `
Customer Message: ${customerMessage}

Available Products:
${products.map((p: any) => {
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

    res.json({
      suggestions,
      decision: {
        action: "REPLY",
        reason: decision.reason,
        productKnown: productContext.productKnown,
        matchedProduct: productContext.matchedProduct,
        intent,
      },
    });
  } catch (err: any) {
    console.error("AI suggest-reply error:", err);

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