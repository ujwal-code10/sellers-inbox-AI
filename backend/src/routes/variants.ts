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

    try {
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
      const result = await pool.query(
        `UPDATE variants
         SET available = $1
         WHERE id = $2
         RETURNING id, available`,
        [available, variantId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Variant not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
