import pool from "../utils/db.js";
import {
  DeliveryZoneCreateInput,
  DeliveryZoneUpdateInput,
} from "../models/delivery.js";

export async function insertDeliveryZone(
  userId: number,
  input: DeliveryZoneCreateInput
) {
  const result = await pool.query(
    `INSERT INTO delivery_zones (user_id, name, price, cod_available)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, name, price::double precision AS price, cod_available, created_at`,
    [userId, input.name, input.price, input.codAvailable]
  );

  return result.rows[0];
}

export async function selectDeliveryZonesByUser(userId: number) {
  const result = await pool.query(
    `SELECT id, name, price::double precision AS price, cod_available, created_at
     FROM delivery_zones
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return result.rows;
}

export async function updateDeliveryZoneByUser(
  userId: number,
  deliveryZoneId: string,
  input: DeliveryZoneUpdateInput
) {
  const updates: string[] = [];
  const values: Array<string | number | boolean> = [];
  let paramCount = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(input.name);
  }
  if (input.price !== undefined) {
    updates.push(`price = $${paramCount++}`);
    values.push(input.price);
  }
  if (input.codAvailable !== undefined) {
    updates.push(`cod_available = $${paramCount++}`);
    values.push(input.codAvailable);
  }

  values.push(deliveryZoneId, userId);

  const result = await pool.query(
    `UPDATE delivery_zones
     SET ${updates.join(", ")}
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING id, name, price::double precision AS price, cod_available, created_at`,
    values
  );

  return result.rows[0] || null;
}

export async function deleteDeliveryZoneByUser(
  userId: number,
  deliveryZoneId: string
) {
  const result = await pool.query(
    `DELETE FROM delivery_zones
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [deliveryZoneId, userId]
  );

  return result.rows.length > 0;
}
