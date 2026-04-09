import pool from "../utils/db.js";
import { ProductCreateInput, ProductUpdateInput } from "../models/product.js";

export async function insertProduct(userId: number, input: ProductCreateInput) {
  const result = await pool.query(
    `INSERT INTO products (user_id, name, price, keywords, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, price::double precision AS price, keywords, notes`,
    [userId, input.name, input.price, input.keywords, input.notes]
  );

  return result.rows[0];
}

export async function selectProductsWithVariantsByUser(userId: number) {
  const result = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.price::double precision AS price,
       p.keywords,
       p.notes,
       COALESCE(
         json_agg(
           json_build_object(
             'id', v.id,
             'product_id', p.id,
             'color', v.color,
             'size', v.size,
             'available', v.available
           )
           ORDER BY v.id
         ) FILTER (WHERE v.id IS NOT NULL),
         '[]'::json
       ) AS variants
     FROM products p
     LEFT JOIN variants v ON v.product_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.id DESC`,
    [userId]
  );

  return result.rows;
}

export async function updateProductByUser(
  userId: number,
  productId: string,
  input: ProductUpdateInput
) {
  const result = await pool.query(
    `UPDATE products
     SET name = COALESCE($1, name),
         price = COALESCE($2, price),
         keywords = $3,
         notes = $4
     WHERE id = $5 AND user_id = $6
     RETURNING id, name, price::double precision AS price, keywords, notes`,
    [
      input.name,
      input.price,
      input.keywords || null,
      input.notes || null,
      productId,
      userId,
    ]
  );

  return result.rows[0] || null;
}

export async function deleteProductByUser(userId: number, productId: string) {
  const result = await pool.query(
    `DELETE FROM products
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [productId, userId]
  );

  return result.rows.length > 0;
}
