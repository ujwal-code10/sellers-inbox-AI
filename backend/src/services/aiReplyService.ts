import Groq from "groq-sdk";
import pool from "../utils/db.js";
import { SYSTEM_PROMPT } from "../ai/systemprompt.js";
import { resolveProductContext } from "../product/productResolver.js";
import { decideReply } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";
import { incrementReplyCount } from "../middleware/checkPlan.js";
import { SellerIntent, SuggestReplyInput, SuggestReplyResponse } from "../models/ai.js";
import { logAIUsage } from "./aiUsageService.js";

type MessageComplexity = "SHORT" | "MEDIUM_OR_COMPLEX";

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

function formatNaturalList(values: string[]): string {
  const cleaned = values.map((value) => value.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return "";
  }

  if (cleaned.length === 1) {
    return cleaned[0];
  }

  if (cleaned.length === 2) {
    return `${cleaned[0]} ra ${cleaned[1]}`;
  }

  const allButLast = cleaned.slice(0, -1).join(", ");
  return `${allButLast} ra ${cleaned[cleaned.length - 1]}`;
}

function hasListRequestSignal(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /\b(kun|kunkun|what|which|all|sab|sabai|haru)\b/.test(normalized) ||
    normalized.includes("kun kun") ||
    normalized.includes("kun-kun")
  );
}

function asksForSizeOptions(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  const asksListSignal = hasListRequestSignal(message);

  return /\bsize(s)?\b/.test(lowerMsg) && asksListSignal;
}

function asksForColorOptions(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  const asksListSignal = hasListRequestSignal(message);

  return /\b(color|colour|colors|colours|rang)\b/.test(lowerMsg) && asksListSignal;
}

function classifyMessageComplexity(message: string): MessageComplexity {
  const compact = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) {
    return "SHORT";
  }

  const tokenCount = compact.split(" ").filter(Boolean).length;
  const hasJoiner = /\b(ra|and|ani|plus|also|with|sanga)\b/.test(compact);
  const questionMarks = message.match(/\?/g)?.length ?? 0;

  if (tokenCount <= 4 && compact.length <= 32 && !hasJoiner && questionMarks <= 1) {
    return "SHORT";
  }

  return "MEDIUM_OR_COMPLEX";
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
        `\\b${escapeRegExp(normalizedSize)}\\b\\s*size\\b|\\bsize\\b\\s*${escapeRegExp(
          normalizedSize
        )}\\b`
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
  const sizeOptionsAsked = asksForSizeOptions(customerMessage);
  const colorOptionsAsked = asksForColorOptions(customerMessage);

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

  if (requestedColor && sizeOptionsAsked) {
    const sizesForColor = getUniqueVariantValues(
      availableVariants.filter(
        (variant) => String(variant.color).toLowerCase() === requestedColor.toLowerCase()
      ),
      "size"
    );

    if (sizesForColor.length > 0) {
      return `${requestedColor} color ma available size ${formatNaturalList(sizesForColor)} cha.`;
    }

    return `${requestedColor} color ma size aaile available chaina.`;
  }

  if (requestedSize && colorOptionsAsked) {
    const colorsForSize = getUniqueVariantValues(
      availableVariants.filter(
        (variant) => String(variant.size).toLowerCase() === requestedSize.toLowerCase()
      ),
      "color"
    );

    if (colorsForSize.length > 0) {
      return `${requestedSize} size ma available color ${formatNaturalList(colorsForSize)} cha.`;
    }

    return `${requestedSize} size ma color aaile available chaina.`;
  }

  if (sizeOptionsAsked) {
    const sizes = getUniqueVariantValues(availableVariants, "size");
    if (sizes.length > 0) {
      return `${product.name} ma available size ${formatNaturalList(sizes)} cha.`;
    }

    return `${product.name} ko size aaile available chaina.`;
  }

  if (colorOptionsAsked) {
    const colors = getUniqueVariantValues(availableVariants, "color");
    if (colors.length > 0) {
      return `${product.name} ma available color ${formatNaturalList(colors)} cha.`;
    }

    return `${product.name} ko color aaile available chaina.`;
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

function findMatchedProductByName(
  products: any[],
  productName?: string
): any | null {
  if (!productName) {
    return null;
  }

  const normalizedTarget = productName.trim().toLowerCase();
  if (!normalizedTarget) {
    return null;
  }

  return (
    products.find(
      (product: any) => String(product.name).trim().toLowerCase() === normalizedTarget
    ) || null
  );
}

function buildContextMessage(params: {
  customerMessage: string;
  backendIntent: SellerIntent;
  priceAskedInMessage: boolean;
  messageComplexity: MessageComplexity;
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
Message Complexity: ${params.messageComplexity}
Conversation Stage: ${params.followUpContext ? "FOLLOW_UP" : "FIRST_MESSAGE"}
Backend Instruction:
- If price asked is NO, do NOT include price in the reply.
- If intent is AVAILABILITY and price asked is NO, reply availability only.
- Include price only when customer explicitly asked for price in the same message.
- If conversation stage is FOLLOW_UP, do NOT use "Cha hajur 😊".
- For follow-up availability questions, answer only what is asked.
- If customer asks only size, do not list all colors.
- If customer asks only color, do not list all sizes.

Reply Planning Instruction:
- If message complexity is SHORT:
  - Keep reply to one short line.
  - Answer the asked intent only.
  - Do NOT add extra details unless explicitly asked in the same message.
- If message complexity is MEDIUM_OR_COMPLEX:
  - Line 1: answer the main intent immediately.
  - Line 2: add only ONE next useful detail (price, variant, delivery, or COD) if relevant.
  - Do NOT add more than two short lines unless customer clearly asked a combo question.

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

function joinReplyLines(primaryLine: string, nextDetailLine?: string | null): string {
  const main = primaryLine.trim();
  const extra = nextDetailLine?.trim() || "";

  if (!extra) {
    return main;
  }

  const mainNorm = normalizeLookupText(main);
  const extraNorm = normalizeLookupText(extra);

  if (!extraNorm || extraNorm === mainNorm || mainNorm.includes(extraNorm)) {
    return main;
  }

  return `${main} ${extra}`;
}

function buildAvailableSizeDetail(productName: string, productVariants: any[]): string | null {
  const sizes = getUniqueVariantValues(
    productVariants.filter((variant) => Boolean(variant.available)),
    "size"
  );

  if (sizes.length === 0) {
    return null;
  }

  return `${productName} ma available size ${formatNaturalList(sizes)} cha.`;
}

function buildAvailableColorDetail(productName: string, productVariants: any[]): string | null {
  const colors = getUniqueVariantValues(
    productVariants.filter((variant) => Boolean(variant.available)),
    "color"
  );

  if (colors.length === 0) {
    return null;
  }

  return `${productName} ma available color ${formatNaturalList(colors)} cha.`;
}

function buildSizesForColorDetail(requestedColor: string, productVariants: any[]): string | null {
  const sizesForColor = getUniqueVariantValues(
    productVariants.filter(
      (variant) =>
        Boolean(variant.available) &&
        String(variant.color).toLowerCase() === requestedColor.toLowerCase()
    ),
    "size"
  );

  if (sizesForColor.length === 0) {
    return null;
  }

  return `${requestedColor} color ko size options ${formatNaturalList(sizesForColor)} ma cha.`;
}

function buildColorsForSizeDetail(requestedSize: string, productVariants: any[]): string | null {
  const colorsForSize = getUniqueVariantValues(
    productVariants.filter(
      (variant) =>
        Boolean(variant.available) &&
        String(variant.size).toLowerCase() === requestedSize.toLowerCase()
    ),
    "color"
  );

  if (colorsForSize.length === 0) {
    return null;
  }

  return `${requestedSize} size ko color options ${formatNaturalList(colorsForSize)} ma cha.`;
}

function buildMediumPriceReply(params: {
  customerMessage: string;
  product: { name: string; price: unknown };
  productVariants: any[];
}): string {
  const { customerMessage, product, productVariants } = params;
  const line1 = buildForcedPriceReply(product);
  const requestedColor = findMentionedColor(customerMessage, productVariants);
  const requestedSize = findMentionedSize(customerMessage, productVariants);
  const sizeOptionsAsked = asksForSizeOptions(customerMessage);
  const colorOptionsAsked = asksForColorOptions(customerMessage);

  if (hasAvailabilitySignal(customerMessage)) {
    const availabilityLine = buildForcedFollowUpAvailabilityReply({
      customerMessage,
      product,
      productVariants,
    });

    return joinReplyLines(line1, availabilityLine);
  }

  let nextDetail: string | null = null;

  if (requestedColor && !requestedSize) {
    nextDetail = buildSizesForColorDetail(requestedColor, productVariants);
  } else if (requestedSize && !requestedColor) {
    nextDetail = buildColorsForSizeDetail(requestedSize, productVariants);
  } else if (sizeOptionsAsked) {
    nextDetail = buildAvailableColorDetail(product.name, productVariants);
  } else if (colorOptionsAsked) {
    nextDetail = buildAvailableSizeDetail(product.name, productVariants);
  }

  if (!nextDetail) {
    nextDetail =
      buildAvailableSizeDetail(product.name, productVariants) ||
      buildAvailableColorDetail(product.name, productVariants) ||
      (productVariants.some((variant) => Boolean(variant.available))
        ? `${product.name} available cha.`
        : `${product.name} aaile sold out cha.`);
  }

  return joinReplyLines(line1, nextDetail);
}

function buildMediumAvailabilityReply(params: {
  customerMessage: string;
  product: { name: string };
  productVariants: any[];
}): string {
  const { customerMessage, product, productVariants } = params;
  const line1 = buildForcedFollowUpAvailabilityReply({
    customerMessage,
    product,
    productVariants,
  });

  const availableVariants = productVariants.filter((variant) => Boolean(variant.available));
  const requestedColor = findMentionedColor(customerMessage, productVariants);
  const requestedSize = findMentionedSize(customerMessage, productVariants);
  const sizeOptionsAsked = asksForSizeOptions(customerMessage);
  const colorOptionsAsked = asksForColorOptions(customerMessage);

  if (sizeOptionsAsked) {
    const colors = getUniqueVariantValues(availableVariants, "color");
    if (colors.length === 0) {
      return line1;
    }

    const line1WithoutTerminal = line1.replace(/[.!?]\s*$/, "");
    return `${line1WithoutTerminal} ane color options ma available color ${formatNaturalList(colors)} cha.`;
  }

  let line2: string | null = null;

  if (requestedColor && !requestedSize) {
    line2 = buildSizesForColorDetail(requestedColor, availableVariants);
  } else if (requestedSize && !requestedColor) {
    line2 = buildColorsForSizeDetail(requestedSize, availableVariants);
  } else if (colorOptionsAsked) {
    line2 = buildAvailableSizeDetail(product.name, availableVariants);
  } else {
    line2 =
      buildAvailableSizeDetail(product.name, availableVariants) ||
      buildAvailableColorDetail(product.name, availableVariants);
  }

  return joinReplyLines(line1, line2);
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

    // SOURCE: forcedProductId comes from authenticated seller UI selection.
    // RISK: if fallback silently broadens to all products, reply can drift or leak cross-product context.
    // PROTECTION: resolve forcedProductId by user_id ownership; if missing return 400 selected product not found.
    // RESULT: deterministic grounding and no semantic alias drift on constrained intents.
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
    const messageComplexity = classifyMessageComplexity(input.customerMessage);
    const priceAskedInMessage = hasPriceSignal(input.customerMessage);

    if (!selectedProduct && !productContext.productKnown && input.followUpContext) {
      const hintedProduct = findMatchedProductByName(products, input.recentProducts[0]);
      if (hintedProduct) {
        productContext = {
          productKnown: true,
          matchedProduct: hintedProduct.name,
          candidateProducts: [
            hintedProduct.name,
            ...(productContext.candidateProducts || []).filter(
              (name) => name.toLowerCase() !== hintedProduct.name.toLowerCase()
            ),
          ].slice(0, 5),
        };

        logAiSelectionDebug("followup_recent_product_applied", {
          userId,
          hintedProductName: hintedProduct.name,
          followUpContext: input.followUpContext,
          recentProducts: input.recentProducts,
        });
      }
    }

    const confidence = calculateConfidence({
      productKnown: productContext.productKnown,
      intent,
      messageComplexity,
    });

    const decision = decideReply({
      intent,
      productKnown: productContext.productKnown,
      confidence,
      messageComplexity,
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
      messageComplexity,
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

    // SOURCE: seller manually selected product for the current customer turn.
    // RISK: short price+availability asks can still drift when sent through LLM.
    // PROTECTION: for selected-product short PRICE intent, use deterministic reply path.
    // RESULT: stable exact-product response for both price-only and combo asks.
    if (selectedProduct && intent === "PRICE" && messageComplexity === "SHORT") {
      const selectedProductVariants = variants.filter(
        (variant: any) => Number(variant.product_id) === Number(selectedProduct.id)
      );

      const directReply = isPriceOnlyMessage
        ? buildForcedPriceReply(selectedProduct)
        : buildMediumPriceReply({
            customerMessage: input.customerMessage,
            product: selectedProduct,
            productVariants: selectedProductVariants,
          });

      logAiSelectionDebug("forced_short_price_reply", {
        userId,
        selectedProductId: Number(selectedProduct.id),
        selectedProductName: selectedProduct.name,
        mode: isPriceOnlyMessage ? "price_only" : "price_with_availability",
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
          reason: `${finalDecision.reason} (short price deterministic rule)`,
          productKnown: true,
          matchedProduct: selectedProduct.name,
          intent,
          productCandidates: [selectedProduct.name],
        },
      };
    }

    const contextualMatchedProduct = findMatchedProductByName(
      products,
      productContext.matchedProduct
    );
    const productForAvailabilityReply = selectedProduct || contextualMatchedProduct;

    if (
      productForAvailabilityReply &&
      intent === "PRICE" &&
      messageComplexity === "MEDIUM_OR_COMPLEX"
    ) {
      const productVariants = variants.filter(
        (variant: any) =>
          Number(variant.product_id) === Number(productForAvailabilityReply.id)
      );

      const directReply = buildMediumPriceReply({
        customerMessage: input.customerMessage,
        product: productForAvailabilityReply,
        productVariants,
      });

      logAiSelectionDebug("forced_medium_price_reply", {
        userId,
        selectedProductId: Number(productForAvailabilityReply.id),
        selectedProductName: productForAvailabilityReply.name,
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
          reason: `${finalDecision.reason} (medium price deterministic next-detail rule)`,
          productKnown: true,
          matchedProduct: productForAvailabilityReply.name,
          intent,
          productCandidates: [productForAvailabilityReply.name],
        },
      };
    }

    if (
      productForAvailabilityReply &&
      intent === "AVAILABILITY" &&
      !priceAskedInMessage
    ) {
      const selectedProductVariants = variants.filter(
        (variant: any) =>
          Number(variant.product_id) === Number(productForAvailabilityReply.id)
      );

      const directReply =
        messageComplexity === "MEDIUM_OR_COMPLEX"
          ? buildMediumAvailabilityReply({
              customerMessage: input.customerMessage,
              product: productForAvailabilityReply,
              productVariants: selectedProductVariants,
            })
          : buildForcedFollowUpAvailabilityReply({
              customerMessage: input.customerMessage,
              product: productForAvailabilityReply,
              productVariants: selectedProductVariants,
            });

      logAiSelectionDebug("forced_followup_availability_reply", {
        userId,
        selectedProductId: Number(productForAvailabilityReply.id),
        selectedProductName: productForAvailabilityReply.name,
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
          reason: `${finalDecision.reason} (concise availability deterministic rule)`,
          productKnown: true,
          matchedProduct: productForAvailabilityReply.name,
          intent,
          productCandidates: [productForAvailabilityReply.name],
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
      messageComplexity,
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
