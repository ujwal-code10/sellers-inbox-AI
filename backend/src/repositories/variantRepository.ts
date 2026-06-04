import pool from "../utils/db.js";
import {
  VariantAvailabilityUpdateInput,
  VariantBulkCreateInput,
  VariantCreateInput,
} from "../models/variant.js";

export async function selectVariantsForProductByUser(userId: number, productId: string) {
  const result = await pool.query(
    `SELECT v.id, v.product_id, v.color, v.size, v.available, v.version
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.product_id = $1 AND p.user_id = $2
     ORDER BY v.id DESC`,
    [productId, userId]
  );

  return result.rows;
}

export async function existsProductForUser(userId: number, productId: string) {
  // SOURCE: userId from auth middleware and productId from route params.
  // RISK: variant writes without ownership check allow cross-tenant modification.
  // PROTECTION: existence check constrained by both product id and user id.
  // RESULT: only owner seller can mutate variants for a product.
  const result = await pool.query(
    `SELECT id FROM products
     WHERE id = $1 AND user_id = $2`,
    [productId, userId]
  );

  return result.rows.length > 0;
}

export async function insertVariant(productId: string, input: VariantCreateInput) {
  const result = await pool.query(
    `INSERT INTO variants (product_id, color, size, available)
     VALUES ($1, $2, $3, $4)
     RETURNING id, product_id, color, size, available, version`,
    [productId, input.color, input.size, input.available]
  );

  return result.rows[0];
}

export async function insertVariantsBulk(
  productId: string,
  input: VariantBulkCreateInput
) {
  const colors = input.variants.map((variant) => variant.color);
  const sizes = input.variants.map((variant) => variant.size);
  const availability = input.variants.map((variant) => variant.available);

  const result = await pool.query(
    `INSERT INTO variants (product_id, color, size, available)
     SELECT
       $1::integer,
       payload.color,
       payload.size,
       payload.available
     FROM unnest($2::text[], $3::text[], $4::boolean[])
       AS payload(color, size, available)
     RETURNING id, product_id, color, size, available, version`,
    [productId, colors, sizes, availability]
  );

  return result.rows;
}

export async function updateVariantAvailabilityByUser(
  userId: number,
  variantId: string,
  input: VariantAvailabilityUpdateInput
) {
  const result = await pool.query(
    `UPDATE variants v
     SET available = $1,
         version = v.version + 1
     FROM products p
     WHERE v.id = $2
       AND v.version = $3
       AND v.product_id = p.id
       AND p.user_id = $4
     RETURNING v.id, v.available, v.version`,
    [input.available, variantId, input.version, userId]
  );

  return result.rows[0] || null;
}

export async function selectVariantVersionByUser(
  userId: number,
  variantId: string
) {
  const result = await pool.query(
    `SELECT v.id, v.version
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.id = $1 AND p.user_id = $2`,
    [variantId, userId]
  );

  return result.rows[0] || null;
}
