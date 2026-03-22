import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";
import { checkProductLimit } from "../middleware/checkPlan.js";

const router = express.Router();

/**
 * Create product
 * POST /api/products
 */
router.post("/", auth, checkProductLimit, async (req: AuthRequest, res) => {
  const { name, price, keywords, notes } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Name and price are required" });
  }

  // Validate product name
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
    return res.status(400).json({ error: "Product name must be 1-255 characters" });
  }

  // Validate price (positive number, reasonable range)
  if (typeof price !== 'number' || price <= 0 || price > 10000000 || !isFinite(price)) {
    return res.status(400).json({ error: "Price must be a positive number between 1 and 10,000,000" });
  }

  // Validate optional fields
  if (keywords && (typeof keywords !== 'string' || keywords.length > 500)) {
    return res.status(400).json({ error: "Keywords too long (max 500 characters)" });
  }

  if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
    return res.status(400).json({ error: "Notes too long (max 2000 characters)" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (user_id, name, price, keywords, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, price, keywords, notes`,
      [req.userId, name, price, keywords || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Get seller products
 * GET /api/products
 */
router.get("/", auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price, keywords, notes
       FROM products
       WHERE user_id = $1
       ORDER BY id DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Update product
 * PATCH /api/products/:id
 */
router.patch("/:id", auth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, price, keywords, notes } = req.body;

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 255)) {
    return res.status(400).json({ error: "Product name must be 1-255 characters" });
  }

  // Validate price if provided
  if (price !== undefined && (typeof price !== 'number' || price <= 0 || price > 10000000 || !isFinite(price))) {
    return res.status(400).json({ error: "Price must be a positive number between 1 and 10,000,000" });
  }

  // Validate optional fields if provided
  if (keywords !== undefined && keywords !== null && (typeof keywords !== 'string' || keywords.length > 500)) {
    return res.status(400).json({ error: "Keywords too long (max 500 characters)" });
  }

  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
    return res.status(400).json({ error: "Notes too long (max 2000 characters)" });
  }

  try {
    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           price = COALESCE($2, price),
           keywords = $3,
           notes = $4
       WHERE id = $5 AND user_id = $6
       RETURNING id, name, price, keywords, notes`,
      [name, price, keywords || null, notes || null, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Delete product
 * DELETE /api/products/:id
 */
router.delete("/:id", auth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    // Variants are automatically deleted via ON DELETE CASCADE in the database schema
    const result = await pool.query(
      `DELETE FROM products
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;