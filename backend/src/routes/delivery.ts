import express from "express";
import auth, { AuthRequest } from "../middleware/auth.js";
import pool from "../utils/db.js";

const router = express.Router();

/**
 * Create or update delivery settings
 * PUT /api/delivery-settings
 */
router.put("/delivery-settings", auth, async (req: AuthRequest, res) => {
  const { withinCityPrice, outsideCityPrice, codAvailable } = req.body;

  if (
    typeof withinCityPrice !== "number" ||
    typeof outsideCityPrice !== "number"
  ) {
    return res
      .status(400)
      .json({ error: "Delivery prices are required" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO delivery_settings (user_id, within_city_price, outside_city_price, cod_available)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        within_city_price = EXCLUDED.within_city_price,
        outside_city_price = EXCLUDED.outside_city_price,
        cod_available = EXCLUDED.cod_available
      RETURNING within_city_price, outside_city_price, cod_available
      `,
      [req.userId, withinCityPrice, outsideCityPrice, codAvailable ?? true]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Get delivery settings
 * GET /api/delivery-settings
 */
router.get("/delivery-settings", auth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `
      SELECT within_city_price, outside_city_price, cod_available
      FROM delivery_settings
      WHERE user_id = $1
      `,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
