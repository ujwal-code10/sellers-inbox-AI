import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import {
  parseCreateVariantsBulkBody,
  parseCreateVariantBody,
  parseVariantAvailabilityBody,
  VariantSchemaError,
} from "../schemas/variantSchemas.js";
import {
  createVariantsBulk,
  createVariant,
  listVariantsForProduct,
  updateVariantAvailability,
  VariantServiceError,
} from "../services/variantService.js";

function getAuthedUserId(req: AuthRequest): number | null {
  return typeof req.userId === "number" ? req.userId : null;
}

function requireSingleParam(
  value: string | string[] | undefined,
  fieldName: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new VariantSchemaError(`${fieldName} is required`);
  }

  return value;
}

function handleError(res: Response, err: unknown, logPrefix: string) {
  if (err instanceof VariantSchemaError || err instanceof VariantServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(logPrefix, err);
  return res.status(500).json({ error: "Server error" });
}

export async function listProductVariantsHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const productId = requireSingleParam(req.params.productId, "Product id");
    const variants = await listVariantsForProduct(userId, productId);
    return res.json(variants);
  } catch (err) {
    return handleError(res, err, "List variants error:");
  }
}

export async function createProductVariantHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const productId = requireSingleParam(req.params.productId, "Product id");
    const input = parseCreateVariantBody(req.body);
    const variant = await createVariant(userId, productId, input);
    return res.status(201).json(variant);
  } catch (err) {
    return handleError(res, err, "Create variant error:");
  }
}

export async function createProductVariantsBulkHandler(
  req: AuthRequest,
  res: Response
) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // SOURCE: bulk variant payload is generated from frontend variant builder rows.
    // RISK: duplicate/invalid bulk rows can create inconsistent inventory state.
    // PROTECTION: validate route product id and parse bulk schema before service orchestration.
    // RESULT: service receives bounded, structured variant batch for safe insertion.
    const productId = requireSingleParam(req.params.productId, "Product id");
    const input = parseCreateVariantsBulkBody(req.body);
    const variants = await createVariantsBulk(userId, productId, input);
    return res.status(201).json(variants);
  } catch (err) {
    return handleError(res, err, "Create variants bulk error:");
  }
}

export async function updateVariantAvailabilityHandler(
  req: AuthRequest,
  res: Response
) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const variantId = requireSingleParam(req.params.variantId, "Variant id");
    const input = parseVariantAvailabilityBody(req.body);
    const variant = await updateVariantAvailability(userId, variantId, input);
    return res.json(variant);
  } catch (err) {
    return handleError(res, err, "Update variant availability error:");
  }
}
