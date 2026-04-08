import { Router, Response } from "express";
import { adminAuth, AdminRequest } from "../middleware/adminAuth.js";
import {
  getDashboardStats,
  getUserGrowth,
  getRevenueMetrics,
  getAIUsageMetrics,
} from "../services/analyticsService.js";
import { getAuditLogs } from "../services/auditService.js";

const router = Router();

// GET /admin/dashboard - Main dashboard overview
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /admin/dashboard/users - User growth metrics
router.get("/users", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const parsedDays = parseInt(days as string, 10);
    const daysNum = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(7, parsedDays))
      : 30;

    const data = await getUserGrowth(daysNum);
    res.json({ data });
  } catch (err) {
    console.error("User growth error:", err);
    res.status(500).json({ error: "Failed to get user growth" });
  }
});

// GET /admin/dashboard/revenue - Revenue metrics
router.get("/revenue", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const parsedDays = parseInt(days as string, 10);
    const daysNum = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(7, parsedDays))
      : 30;

    const data = await getRevenueMetrics(daysNum);
    res.json({ data });
  } catch (err) {
    console.error("Revenue metrics error:", err);
    res.status(500).json({ error: "Failed to get revenue metrics" });
  }
});

// GET /admin/dashboard/ai - AI usage metrics
router.get("/ai", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const parsedDays = parseInt(days as string, 10);
    const daysNum = Number.isFinite(parsedDays)
      ? Math.min(90, Math.max(7, parsedDays))
      : 30;

    const data = await getAIUsageMetrics(daysNum);
    res.json({ data });
  } catch (err) {
    console.error("AI metrics error:", err);
    res.status(500).json({ error: "Failed to get AI metrics" });
  }
});

// GET /admin/audit-logs - Audit logs
router.get("/audit-logs", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      admin_id,
      action,
      entity_type,
      from,
      to,
    } = req.query;

    const result = await getAuditLogs({
      adminId: admin_id ? parseInt(admin_id as string, 10) : undefined,
      action: action as string,
      entityType: entity_type as string,
      from: from as string,
      to: to as string,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    res.json(result);
  } catch (err) {
    console.error("Audit logs error:", err);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

export default router;
