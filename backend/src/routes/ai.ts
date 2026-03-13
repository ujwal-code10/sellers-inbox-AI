import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT } from "../ai/systemprompt.js";
import { resolveProductContext } from "../product/productResolver.js";
import { decideReply } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";

const router = express.Router();

// Clarification messages for ASK action
const CLARIFICATION_MESSAGES = [
  "hajur le kun product ko barema sodhnu bhayeko ho?😊",
 
];

/**
 * Detect intent from message (simple keyword-based for MVP)
 */
function detectIntent(message: string): "PRICE" | "AVAILABILITY" | "DELIVERY" | "DELIVERY_CONFIRM" | "COD" | "DETAILS" | "GENERAL" | "UNKNOWN" {
  const lowerMsg = message.toLowerCase();
  
  // Check COD questions
  if (lowerMsg.includes("cod") || lowerMsg.includes("cash on delivery")) {
    return "COD";
  }
  
  // Check DELIVERY CONFIRMATION - customer says delivery hunxa/huncha (they want delivery)
  if ((lowerMsg.includes("delivery") || lowerMsg.includes("deliver")) && 
      (lowerMsg.match(/\bhunxa\b/) || lowerMsg.match(/\bhuncha\b/) || lowerMsg.match(/\bhunxa\b/) || lowerMsg.includes("garnu"))) {
    return "DELIVERY_CONFIRM";
  }
  
  // Check DELIVERY questions first (before AVAILABILITY) to avoid "huncha" matching "cha"
  if (lowerMsg.includes("delivery") || lowerMsg.includes("shipping") || lowerMsg.includes("pathau") || lowerMsg.includes("deliver")) {
    return "DELIVERY";
  }
  
  if (lowerMsg.includes("price") || lowerMsg.includes("kati") || lowerMsg.includes("cost")) {
    return "PRICE";
  }
  
  // Check for details/info queries - when customer asks about product details
  if (lowerMsg.includes("details") || lowerMsg.includes("detail") || lowerMsg.includes("info") || lowerMsg.includes("information") || lowerMsg.includes("barema") || lowerMsg.includes("bare")) {
    return "DETAILS";
  }
  
  // More precise availability check - avoid matching "huncha" as availability
  // Use word boundaries or check for specific availability phrases
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

router.post("/ai/suggest-reply", auth, async (req: AuthRequest, res) => {
  const { customerMessage } = req.body;

  if (!customerMessage) {
    return res.status(400).json({ error: "customerMessage required" });
  }

  try {
    // 1. Get products
    const productsRes = await pool.query(
      `SELECT id, name, price FROM products WHERE user_id = $1`,
      [req.userId]
    );

    // 2. Get variants
    const variantsRes = await pool.query(
      `
      SELECT v.id, v.product_id, v.color, v.size, v.available
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE p.user_id = $1
      `,
      [req.userId]
    );

    const products = productsRes.rows;
    const variants = variantsRes.rows;

    // Extract product names for matching
    const productNames = products.map((p: any) => p.name);

    // 3. Resolve product context using decision engine
    const productContext = resolveProductContext({
      messageText: customerMessage,
      hasMedia: false,
      source: "DM",
      productNames,
    });

    // 4. Detect intent
    const intent = detectIntent(customerMessage);

    // 5. Calculate confidence
    const confidence = calculateConfidence({
      productKnown: productContext.productKnown,
      intent,
    });

    // 6. Decide action: REPLY or ASK
    const decision = decideReply({
      intent,
      productKnown: productContext.productKnown,
      confidence,
    });

    // 7. If ASK → return clarification, don't call AI
    if (decision.action === "ASK") {
      return res.json({
        suggestions: CLARIFICATION_MESSAGES,
        decision: {
          action: "ASK",
          reason: decision.reason,
          productKnown: productContext.productKnown,
          intent,
        }
      });
    }

    // 8. If REPLY → generate AI suggestions
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Get delivery zones
    const zonesRes = await pool.query(
      `
      SELECT id, name, price, cod_available
      FROM delivery_zones
      WHERE user_id = $1
      ORDER BY created_at ASC
      `,
      [req.userId]
    );

    const deliveryRes = await pool.query(
      `
      SELECT within_city_price, outside_city_price, cod_available
      FROM delivery_settings
      WHERE user_id = $1
      `,
      [req.userId]
    );

    const deliveryZones = zonesRes.rows;
    const oldDelivery = deliveryRes.rows[0] || null;

    // Build delivery context
    let deliveryContext = '';
    if (deliveryZones.length > 0) {
      deliveryContext = `Delivery Zones (use EXACT zone names and prices when customer asks about delivery):
${deliveryZones.map((z: any) => `- ${z.name}: Rs. ${z.price} (COD: ${z.cod_available ? 'Yes' : 'No'})`).join('\n')}

IMPORTANT: Only mention delivery if customer asks. Use the exact zone names above, not generic terms like "valley".`;
    } else if (oldDelivery) {
      deliveryContext = `Delivery Info (only mention if customer asks about delivery):
- Within city: Rs. ${oldDelivery.within_city_price}
- Outside city: Rs. ${oldDelivery.outside_city_price}
- COD: ${oldDelivery.cod_available ? 'Available' : 'Not available'}`;
    } else {
      deliveryContext = 'No delivery info available. If customer asks about delivery, say "Delivery charge baare seller lai sodhnu hola."';
    }

    const contextMessage = `
Customer Message: ${customerMessage}

Available Products:
${products.map((p: any) => {
  const productVariants = variants.filter((v: any) => v.product_id === p.id);
  return `- ${p.name} (Rs. ${p.price})
  Variants: ${productVariants.map((v: any) => `${v.color} ${v.size} (${v.available ? 'Available' : 'Out of stock'})`).join(', ')}`;
}).join('\n')}

${deliveryContext}
`;

    // Generate AI suggestion using Groq
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      temperature: 0.7,
    });

    const suggestions = [
      completion.choices[0]?.message.content || "",
    ];

    res.json({
      suggestions,
      decision: {
        action: "REPLY",
        reason: decision.reason,
        productKnown: productContext.productKnown,
        matchedProduct: productContext.matchedProduct,
        intent,
      }
    });
  } catch (err: any) {
    console.error(err);
    
    // Handle Groq API errors
    if (err?.status === 429) {
      return res.status(503).json({
        error: "AI service temporarily unavailable. Please try again later.",
        details: "Groq API rate limit exceeded. Try again in a moment."
      });
    }

    if (err?.status === 401) {
      return res.status(503).json({
        error: "AI service configuration error.",
        details: "Invalid Groq API key."
      });
    }
    
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
































