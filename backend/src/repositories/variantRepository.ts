import pool from "../utils/db.js";
import {
  VariantAvailabilityUpdateInput,
  VariantBulkCreateInput,
  VariantCreateInput,
} from "../models/variant.js";

export async function selectVariantsForProductByUser(userId: number, productId: string) {
  const result = await pool.query(
    `SELECT v.id, v.product_id, v.color, v.size, v.available
     FROM variants v
     JOIN products p ON p.id = v.product_id
     WHERE v.product_id = $1 AND p.user_id = $2
     ORDER BY v.id DESC`,
    [productId, userId]
  );

  return result.rows;
}

export async function existsProductForUser(userId: number, productId: string) {
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
     RETURNING id, product_id, color, size, available`,
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
     RETURNING id, product_id, color, size, available`,
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
     SET available = $1
     FROM products p
     WHERE v.id = $2
       AND v.product_id = p.id
       AND p.user_id = $3
     RETURNING v.id, v.available`,
    [input.available, variantId, userId]
  );

  return result.rows[0] || null;
}
