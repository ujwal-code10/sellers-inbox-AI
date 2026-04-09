import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import {
  parseCreateProductBody,
  parseUpdateProductBody,
  ProductSchemaError,
} from "../schemas/productSchemas.js";
import {
  createProduct,
  deleteProduct,
  listProducts,
  ProductServiceError,
  updateProduct,
} from "../services/productService.js";

function getAuthedUserId(req: AuthRequest): number | null {
  return typeof req.userId === "number" ? req.userId : null;
}

function requireSingleParam(
  value: string | string[] | undefined,
  fieldName: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProductSchemaError(`${fieldName} is required`);
  }

  return value;
}

function handleError(res: Response, err: unknown, logPrefix: string) {
  if (err instanceof ProductSchemaError || err instanceof ProductServiceError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(logPrefix, err);
  return res.status(500).json({ error: "Server error" });
}

export async function createProductHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const input = parseCreateProductBody(req.body);
    const product = await createProduct(userId, input);
    return res.status(201).json(product);
  } catch (err) {
    return handleError(res, err, "Create product error:");
  }
}

export async function listProductsHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const products = await listProducts(userId);
    return res.json(products);
  } catch (err) {
    return handleError(res, err, "List products error:");
  }
}

export async function updateProductHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const productId = requireSingleParam(req.params.id, "Product id");
    const input = parseUpdateProductBody(req.body);
    const product = await updateProduct(userId, productId, input);
    return res.json(product);
  } catch (err) {
    return handleError(res, err, "Update product error:");
  }
}

export async function deleteProductHandler(req: AuthRequest, res: Response) {
  const userId = getAuthedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const productId = requireSingleParam(req.params.id, "Product id");
    const result = await deleteProduct(userId, productId);
    return res.json(result);
  } catch (err) {
    return handleError(res, err, "Delete product error:");
  }
}
