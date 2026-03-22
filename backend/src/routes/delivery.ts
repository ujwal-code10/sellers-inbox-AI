import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";

const router = express.Router();

/**
 * Create delivery zone
 * POST /api/delivery-zones
 */
router.post("/delivery-zones", auth, async (req: AuthRequest, res) => {
  const { name, price, codAvailable } = req.body;

  if (!name || typeof price !== "number") {
    return res.status(400).json({ error: "name and price are required" });
  }

  // Validate zone name
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
    return res.status(400).json({ error: "Zone name must be 1-255 characters" });
  }

  // Validate price (must be non-negative, finite, and reasonable)
  if (price < 0 || price > 10000 || !isFinite(price)) {
    return res.status(400).json({ error: "Price must be between 0 and 10,000" });
  }

  // Validate codAvailable if provided
  if (codAvailable !== undefined && typeof codAvailable !== 'boolean') {
    return res.status(400).json({ error: "codAvailable must be true or false" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO delivery_zones (user_id, name, price, cod_available)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, name, price, cod_available, created_at`,
      [req.userId, name, price, codAvailable ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Get all delivery zones
 * GET /api/delivery-zones
 */
router.get("/delivery-zones", auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, price, cod_available, created_at
       FROM delivery_zones
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Update delivery zone
 * PATCH /api/delivery-zones/:id
 */
router.patch("/delivery-zones/:id", auth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, price, codAvailable } = req.body;

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 255)) {
    return res.status(400).json({ error: "Zone name must be 1-255 characters" });
  }

  // Validate price if provided
  if (price !== undefined && (typeof price !== 'number' || price < 0 || price > 10000 || !isFinite(price))) {
    return res.status(400).json({ error: "Price must be between 0 and 10,000" });
  }

  // Validate codAvailable if provided
  if (codAvailable !== undefined && typeof codAvailable !== 'boolean') {
    return res.status(400).json({ error: "codAvailable must be true or false" });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (codAvailable !== undefined) {
      updates.push(`cod_available = $${paramCount++}`);
      values.push(codAvailable);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id, req.userId);

    const result = await pool.query(
      `UPDATE delivery_zones
       SET ${updates.join(", ")}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING id, name, price, cod_available, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Delivery zone not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Delete delivery zone
 * DELETE /api/delivery-zones/:id
 */
router.delete("/delivery-zones/:id", auth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM delivery_zones
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Delivery zone not found" });
    }

    res.json({ message: "Delivery zone deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;