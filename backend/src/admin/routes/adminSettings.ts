import { Router, Response } from "express";
import pool from "../../utils/db.js";
import {
  adminAuth,
  requireSuperAdmin,
  AdminRequest,
} from "../middleware/adminAuth.js";
import { createAuditLog } from "../services/auditService.js";

const router = Router();

// GET /admin/settings - Get all settings
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT key, value, description, updated_at
       FROM system_settings
       ORDER BY key`
    );

    res.json({ settings: result.rows });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to get settings" });
  }
});

// GET /admin/settings/:key - Get specific setting
router.get("/:key", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { key } = req.params;

    const result = await pool.query(
      `SELECT key, value, description, updated_at
       FROM system_settings
       WHERE key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Setting not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get setting error:", err);
    res.status(500).json({ error: "Failed to get setting" });
  }
});

// PATCH /admin/settings/:key - Update setting (super_admin only)
router.patch(
  "/:key",
  adminAuth,
  requireSuperAdmin,
  async (req: AdminRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
      }

      // Get current value
      const currentResult = await pool.query(
        `SELECT value FROM system_settings WHERE key = $1`,
        [key]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: "Setting not found" });
      }

      const oldValue = currentResult.rows[0].value;

      // Update setting
      await pool.query(
        `UPDATE system_settings
         SET value = $1, updated_by = $2, updated_at = NOW()
         WHERE key = $3`,
        [JSON.stringify(value), req.adminId, key]
      );

      await createAuditLog({
        adminId: req.adminId!,
        action: "settings.update",
        entityType: "setting",
        oldValue: { key, value: oldValue },
        newValue: { key, value },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ message: "Setting updated successfully" });
    } catch (err) {
      console.error("Update setting error:", err);
      res.status(500).json({ error: "Failed to update setting" });
    }
  }
);

export default router;
