import {
  VariantAvailabilityUpdateInput,
  VariantBulkCreateInput,
  VariantCreateInput,
} from "../models/variant.js";
import {
  existsProductForUser,
  insertVariantsBulk,
  insertVariant,
  selectVariantsForProductByUser,
  selectVariantVersionByUser,
  updateVariantAvailabilityByUser,
} from "../repositories/variantRepository.js";

export class VariantServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "VariantServiceError";
    this.status = status;
  }
}

export async function listVariantsForProduct(userId: number, productId: string) {
  try {
    return await selectVariantsForProductByUser(userId, productId);
  } catch {
    throw new VariantServiceError("Server error", 500);
  }
}

export async function createVariant(
  userId: number,
  productId: string,
  input: VariantCreateInput
) {
  try {
    const hasOwnerAccess = await existsProductForUser(userId, productId);

    if (!hasOwnerAccess) {
      throw new VariantServiceError("Product not found or access denied", 404);
    }

    return await insertVariant(productId, input);
  } catch (err) {
    if (err instanceof VariantServiceError) {
      throw err;
    }

    throw new VariantServiceError("Server error", 500);
  }
}

export async function createVariantsBulk(
  userId: number,
  productId: string,
  input: VariantBulkCreateInput
) {
  try {
    // SOURCE: bulk variant target product id is provided from route params.
    // RISK: inserting variants without ownership check allows cross-tenant product mutation.
    // PROTECTION: verify product belongs to authenticated user before bulk insert.
    // RESULT: variant creation remains tenant-isolated.
    const hasOwnerAccess = await existsProductForUser(userId, productId);

    if (!hasOwnerAccess) {
      throw new VariantServiceError("Product not found or access denied", 404);
    }

    return await insertVariantsBulk(productId, input);
  } catch (err) {
    if (err instanceof VariantServiceError) {
      throw err;
    }

    throw new VariantServiceError("Server error", 500);
  }
}

export async function updateVariantAvailability(
  userId: number,
  variantId: string,
  input: VariantAvailabilityUpdateInput
) {
  try {
    const updated = await updateVariantAvailabilityByUser(userId, variantId, input);

    if (!updated) {
      const existing = await selectVariantVersionByUser(userId, variantId);
      if (!existing) {
        throw new VariantServiceError("Variant not found or access denied", 404);
      }

      throw new VariantServiceError(
        "Variant was updated by another session. Refresh and try again.",
        409
      );
    }

    return updated;
  } catch (err) {
    if (err instanceof VariantServiceError) {
      throw err;
    }

    throw new VariantServiceError("Server error", 500);
  }
}
