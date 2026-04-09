import { ProductCreateInput, ProductUpdateInput } from "../models/product.js";
import {
  deleteProductByUser,
  insertProduct,
  selectProductsWithVariantsByUser,
  updateProductByUser,
} from "../repositories/productRepository.js";

export class ProductServiceError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "ProductServiceError";
    this.status = status;
  }
}

export async function createProduct(userId: number, input: ProductCreateInput) {
  try {
    return await insertProduct(userId, input);
  } catch {
    throw new ProductServiceError("Server error", 500);
  }
}

export async function listProducts(userId: number) {
  try {
    return await selectProductsWithVariantsByUser(userId);
  } catch {
    throw new ProductServiceError("Server error", 500);
  }
}

export async function updateProduct(
  userId: number,
  productId: string,
  input: ProductUpdateInput
) {
  try {
    const product = await updateProductByUser(userId, productId, input);

    if (!product) {
      throw new ProductServiceError("Product not found", 404);
    }

    return product;
  } catch (err) {
    if (err instanceof ProductServiceError) {
      throw err;
    }

    throw new ProductServiceError("Server error", 500);
  }
}

export async function deleteProduct(userId: number, productId: string) {
  try {
    const deleted = await deleteProductByUser(userId, productId);

    if (!deleted) {
      throw new ProductServiceError("Product not found", 404);
    }

    return { message: "Product deleted successfully" };
  } catch (err) {
    if (err instanceof ProductServiceError) {
      throw err;
    }

    throw new ProductServiceError("Server error", 500);
  }
}
