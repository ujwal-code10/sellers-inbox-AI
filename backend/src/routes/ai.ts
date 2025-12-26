import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";

const router = express.Router();

router.post("/ai/suggest-reply", auth, async (req: AuthRequest, res) => {
  const { customerMessage } = req.body;

  if (!customerMessage) {
    return res.status(400).json({ error: "customerMessage required" });
  }

  try {
    // 1. Get products
    const productsRes = await pool.query(
      `SELECT id, name, price FROM products WHERE user_id = $1`,
      [req.userId]
    );

    // 2. Get variants
    const variantsRes = await pool.query(
      `
      SELECT v.id, v.product_id, v.color, v.size, v.available
      FROM variants v
      JOIN products p ON p.id = v.product_id
      WHERE p.user_id = $1
      `,
      [req.userId]
    );

    // 3. Get delivery settings
    const deliveryRes = await pool.query(
      `
      SELECT within_city_price, outside_city_price, cod_available
      FROM delivery_settings
      WHERE user_id = $1
      `,
      [req.userId]
    );

    // TEMP response to verify context
    res.json({
      customerMessage,
      products: productsRes.rows,
      variants: variantsRes.rows,
      delivery: deliveryRes.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
































