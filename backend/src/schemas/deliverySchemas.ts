import {
  DeliveryZoneCreateInput,
  DeliveryZoneUpdateInput,
} from "../models/delivery.js";

export class DeliverySchemaError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "DeliverySchemaError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseCreateDeliveryZoneBody(
  body: unknown
): DeliveryZoneCreateInput {
  if (!isRecord(body)) {
    throw new DeliverySchemaError("Invalid request body");
  }

  const { name, price, codAvailable } = body;

  if (!name || typeof price !== "number") {
    throw new DeliverySchemaError("name and price are required");
  }

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 255) {
    throw new DeliverySchemaError("Zone name must be 1-255 characters");
  }

  const trimmedName = name.trim();

  if (/^-\d+(\.\d+)?$/.test(trimmedName)) {
    throw new DeliverySchemaError("Zone name cannot be a negative number");
  }

  if (!/[A-Za-z]/.test(trimmedName)) {
    throw new DeliverySchemaError("Zone name must include at least one letter");
  }

  if (price < 0 || price > 10000 || !isFinite(price)) {
    throw new DeliverySchemaError("Price must be between 0 and 10,000");
  }

  if (codAvailable !== undefined && typeof codAvailable !== "boolean") {
    throw new DeliverySchemaError("codAvailable must be true or false");
  }

  return {
    name,
    price,
    codAvailable: typeof codAvailable === "boolean" ? codAvailable : true,
  };
}

export function parseUpdateDeliveryZoneBody(
  body: unknown
): DeliveryZoneUpdateInput {
  // SOURCE: optional zone update fields come from seller delivery settings edits.
  // RISK: accepting empty or invalid update payloads causes ambiguous no-op mutations.
  // PROTECTION: validate field bounds/types and reject requests with no update fields.
  // RESULT: delivery service receives meaningful, safe update instructions only.
  if (!isRecord(body)) {
    throw new DeliverySchemaError("Invalid request body");
  }

  const { name, price, codAvailable } = body;

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0 || name.length > 255)
  ) {
    throw new DeliverySchemaError("Zone name must be 1-255 characters");
  }

  if (name !== undefined) {
    const trimmedName = name.trim();

    if (/^-\d+(\.\d+)?$/.test(trimmedName)) {
      throw new DeliverySchemaError("Zone name cannot be a negative number");
    }

    if (!/[A-Za-z]/.test(trimmedName)) {
      throw new DeliverySchemaError("Zone name must include at least one letter");
    }
  }

  if (
    price !== undefined &&
    (typeof price !== "number" || price < 0 || price > 10000 || !isFinite(price))
  ) {
    throw new DeliverySchemaError("Price must be between 0 and 10,000");
  }

  if (codAvailable !== undefined && typeof codAvailable !== "boolean") {
    throw new DeliverySchemaError("codAvailable must be true or false");
  }

  if (name === undefined && price === undefined && codAvailable === undefined) {
    throw new DeliverySchemaError("No fields to update");
  }

  return {
    name: name as string | undefined,
    price: price as number | undefined,
    codAvailable: codAvailable as boolean | undefined,
  };
}
