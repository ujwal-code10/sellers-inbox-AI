import { MessageSource, SuggestReplyInput } from "../models/ai.js";

const ALLOWED_SOURCES: MessageSource[] = ["STORY_REPLY", "REEL_FORWARD", "DM"];
const ALLOWED_TONES = ["friendly", "professional", "persuasive"];

export class AISchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "AISchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNormalizedSource(value: unknown): MessageSource {
  if (typeof value === "string" && ALLOWED_SOURCES.includes(value as MessageSource)) {
    return value as MessageSource;
  }

  return "DM";
}

function toRecentProducts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item: unknown): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 10);
}

export function parseSuggestReplyBody(body: unknown): SuggestReplyInput {
  if (!isRecord(body)) {
    throw new AISchemaError("Invalid request body");
  }

  const customerMessage = body.customerMessage;
  if (!customerMessage) {
    throw new AISchemaError("customerMessage required");
  }

  if (typeof customerMessage !== "string" || customerMessage.length > 2000) {
    throw new AISchemaError("customerMessage must be 1-2000 characters");
  }

  const tone = body.tone;
  if (
    tone &&
    (typeof tone !== "string" || !ALLOWED_TONES.includes(tone.toLowerCase()))
  ) {
    throw new AISchemaError("tone must be friendly, professional, or persuasive");
  }

  const forcedProduct = body.forcedProduct;
  if (
    forcedProduct &&
    (typeof forcedProduct !== "string" || forcedProduct.trim().length === 0)
  ) {
    throw new AISchemaError("forcedProduct must be a valid product name");
  }

  const forcedProductId = body.forcedProductId;
  if (
    forcedProductId !== undefined &&
    forcedProductId !== null &&
    (typeof forcedProductId !== "number" ||
      !Number.isInteger(forcedProductId) ||
      forcedProductId <= 0)
  ) {
    throw new AISchemaError("forcedProductId must be a positive integer");
  }

  const recentProducts = body.recentProducts;
  if (recentProducts && !Array.isArray(recentProducts)) {
    throw new AISchemaError("recentProducts must be an array of product names");
  }

  return {
    customerMessage,
    tone: typeof tone === "string" ? tone : undefined,
    forcedProduct: typeof forcedProduct === "string" ? forcedProduct.trim() : "",
    forcedProductId:
      typeof forcedProductId === "number" && Number.isInteger(forcedProductId)
        ? forcedProductId
        : undefined,
    source: toNormalizedSource(body.source),
    hasMedia: Boolean(body.hasMedia),
    recentProducts: toRecentProducts(recentProducts),
  };
}
