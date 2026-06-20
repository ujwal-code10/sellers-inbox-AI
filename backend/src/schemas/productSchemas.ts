import { ProductCreateInput, ProductUpdateInput } from "../models/product.js";

export class ProductSchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ProductSchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasMeaningfulName(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

export function parseCreateProductBody(body: unknown): ProductCreateInput {
  // SOURCE: product create payload comes from seller onboarding/catalog forms.
  // RISK: unchecked values can create invalid pricing/name data for AI and checkout flows.
  // PROTECTION: enforce required fields and numeric/text bounds before typed output.
  // RESULT: product service receives valid product records ready for persistence.
  if (!isRecord(body)) {
    throw new ProductSchemaError("Invalid request body");
  }

  const { name, price, keywords, notes } = body;

  if (!name || !price) {
    throw new ProductSchemaError("Name and price are required");
  }

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
    throw new ProductSchemaError("Product name must be 1-255 characters");
  }

  if (!hasMeaningfulName(name)) {
    throw new ProductSchemaError(
      "Product name must include at least one letter or number"
    );
  }

  if (typeof price !== "number" || price <= 0 || price > 10000000 || !isFinite(price)) {
    throw new ProductSchemaError(
      "Price must be a positive number between 1 and 10,000,000"
    );
  }

  if (keywords && (typeof keywords !== "string" || keywords.length > 500)) {
    throw new ProductSchemaError("Keywords too long (max 500 characters)");
  }

  if (notes && (typeof notes !== "string" || notes.length > 2000)) {
    throw new ProductSchemaError("Notes too long (max 2000 characters)");
  }

  return {
    name,
    price,
    keywords: (keywords as string | undefined) || null,
    notes: (notes as string | undefined) || null,
  };
}

export function parseUpdateProductBody(body: unknown): ProductUpdateInput {
  if (!isRecord(body)) {
    throw new ProductSchemaError("Invalid request body");
  }

  const { name, price, keywords, notes } = body;

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0 || name.length > 255)
  ) {
    throw new ProductSchemaError("Product name must be 1-255 characters");
  }

  if (typeof name === "string" && !hasMeaningfulName(name)) {
    throw new ProductSchemaError(
      "Product name must include at least one letter or number"
    );
  }

  if (
    price !== undefined &&
    (typeof price !== "number" || price <= 0 || price > 10000000 || !isFinite(price))
  ) {
    throw new ProductSchemaError(
      "Price must be a positive number between 1 and 10,000,000"
    );
  }

  if (
    keywords !== undefined &&
    keywords !== null &&
    (typeof keywords !== "string" || keywords.length > 500)
  ) {
    throw new ProductSchemaError("Keywords too long (max 500 characters)");
  }

  if (
    notes !== undefined &&
    notes !== null &&
    (typeof notes !== "string" || notes.length > 2000)
  ) {
    throw new ProductSchemaError("Notes too long (max 2000 characters)");
  }

  return {
    name: name as string | undefined,
    price: price as number | undefined,
    keywords:
      keywords === undefined ? undefined : (keywords as string | null | undefined) || null,
    notes: notes === undefined ? undefined : (notes as string | null | undefined) || null,
  };
}
