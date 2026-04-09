import {
  VariantBulkCreateInput,
  VariantAvailabilityUpdateInput,
  VariantCreateInput,
} from "../models/variant.js";

export class VariantSchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "VariantSchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCreateVariantBody(body: unknown): VariantCreateInput {
  if (!isRecord(body)) {
    throw new VariantSchemaError("Invalid request body");
  }

  const { color, size, available } = body;

  if (!color || !size) {
    throw new VariantSchemaError("Color and size are required");
  }

  if (typeof color !== "string" || color.trim().length === 0 || color.length > 50) {
    throw new VariantSchemaError("Color must be 1-50 characters");
  }

  if (typeof size !== "string" || size.trim().length === 0 || size.length > 20) {
    throw new VariantSchemaError("Size must be 1-20 characters");
  }

  if (available !== undefined && typeof available !== "boolean") {
    throw new VariantSchemaError("available must be true or false");
  }

  return {
    color,
    size,
    available: typeof available === "boolean" ? available : true,
  };
}

export function parseCreateVariantsBulkBody(body: unknown): VariantBulkCreateInput {
  if (!isRecord(body)) {
    throw new VariantSchemaError("Invalid request body");
  }

  const { variants } = body;

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new VariantSchemaError("variants array is required");
  }

  if (variants.length > 200) {
    throw new VariantSchemaError("Too many variants in one request (max 200)");
  }

  const parsedVariants = variants.map((variant) => parseCreateVariantBody(variant));

  const seen = new Set<string>();
  for (const variant of parsedVariants) {
    const key = `${variant.color.toLowerCase()}::${variant.size.toLowerCase()}`;
    if (seen.has(key)) {
      throw new VariantSchemaError(
        `Duplicate variant combination: ${variant.color} / ${variant.size}`
      );
    }
    seen.add(key);
  }

  return { variants: parsedVariants };
}

export function parseVariantAvailabilityBody(
  body: unknown
): VariantAvailabilityUpdateInput {
  if (!isRecord(body)) {
    throw new VariantSchemaError("Invalid request body");
  }

  const { available } = body;

  if (typeof available !== "boolean") {
    throw new VariantSchemaError("available must be true or false");
  }

  return { available };
}
