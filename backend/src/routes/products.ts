import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";

const router = express.Router();

/**
 * Create product
 * POST /api/products
 */
router.post("/", auth, async (req: AuthRequest, res) => {
  const { name, price } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Name and price are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (user_id, name, price)
       VALUES ($1, $2, $3)
       RETURNING id, name, price`,
      [req.userId, name, price]
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
      `SELECT id, name, price
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

export default router;
