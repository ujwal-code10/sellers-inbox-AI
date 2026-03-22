import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";

const router = express.Router();

/**
 * Get variants for a product
 * GET /api/products/:productId/variants
 */
router.get(
  "/products/:productId/variants",
  auth,
  async (req: AuthRequest, res) => {
    const { productId } = req.params;

    try {
      // Verify product belongs to this seller
      const ownerCheck = await pool.query(
        `SELECT id FROM products
         WHERE id = $1 AND user_id = $2`,
        [productId, req.userId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found or access denied"
        });
      }

      const result = await pool.query(
        `SELECT id, product_id, color, size, available
         FROM variants
         WHERE product_id = $1
         ORDER BY id DESC`,
        [productId]
      );

      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Add variant to a product
 * POST /api/products/:productId/variants
 */
router.post(
  "/products/:productId/variants",
  auth,
  async (req: AuthRequest, res) => {
    const { color, size, available } = req.body;
    const { productId } = req.params;

    if (!color || !size) {
      return res.status(400).json({ error: "Color and size are required" });
    }

    // Validate color input
    if (typeof color !== 'string' || color.trim().length === 0 || color.length > 50) {
      return res.status(400).json({ error: "Color must be 1-50 characters" });
    }

    // Validate size input
    if (typeof size !== 'string' || size.trim().length === 0 || size.length > 20) {
      return res.status(400).json({ error: "Size must be 1-20 characters" });
    }

    // Validate available if provided
    if (available !== undefined && typeof available !== 'boolean') {
      return res.status(400).json({ error: "available must be true or false" });
    }

    try {
      // Verify product belongs to this seller before adding variant
      const ownerCheck = await pool.query(
        `SELECT id FROM products
         WHERE id = $1 AND user_id = $2`,
        [productId, req.userId]
      );

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Product not found or access denied"
        });
      }

      const result = await pool.query(
        `INSERT INTO variants (product_id, color, size, available)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, color, size, available`,
        [productId, color, size, available ?? true]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/**
 * Update variant availability (sold out / restock)
 * PATCH /api/variants/:variantId
 */
router.patch(
  "/variants/:variantId",
  auth,
  async (req: AuthRequest, res) => {
    const { available } = req.body;
    const { variantId } = req.params;

    if (typeof available !== "boolean") {
      return res
        .status(400)
        .json({ error: "available must be true or false" });
    }

    try {
      // JOIN through products to verify this variant
      // belongs to the logged-in seller
      const result = await pool.query(
        `UPDATE variants v
         SET available = $1
         FROM products p
         WHERE v.id = $2
           AND v.product_id = p.id
           AND p.user_id = $3
         RETURNING v.id, v.available`,
        [available, variantId, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Variant not found or access denied"
        });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;