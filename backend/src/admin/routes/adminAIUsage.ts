import { Router, Response } from "express";
import pool from "../../utils/db.js";
import { adminAuth, AdminRequest } from "../middleware/adminAuth.js";

const router = Router();

// GET /admin/ai-usage - List AI usage logs
router.get("/", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      user_id,
      status,
      request_type,
      from,
      to,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (user_id) {
      conditions.push(`al.user_id = $${paramIndex++}`);
      values.push(parseInt(user_id as string, 10));
    }
    if (status) {
      conditions.push(`al.status = $${paramIndex++}`);
      values.push(status);
    }
    if (request_type) {
      conditions.push(`al.request_type = $${paramIndex++}`);
      values.push(request_type);
    }
    if (from) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      values.push(from);
    }
    if (to) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      values.push(to);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_usage_logs al ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated logs
    values.push(limitNum, offset);
    const result = await pool.query(
      `SELECT
         al.*,
         u.name as user_name, u.email as user_email
       FROM ai_usage_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("List AI usage error:", err);
    res.status(500).json({ error: "Failed to list AI usage logs" });
  }
});

// GET /admin/ai-usage/stats - AI usage statistics
router.get("/stats", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    // From ai_usage_logs table (if populated)
    const logsStats = await pool.query(`
      SELECT
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_total,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'success' THEN 1 END) as today_success,
        COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'error' THEN 1 END) as today_failed,
        COALESCE(AVG(CASE WHEN DATE(created_at) = CURRENT_DATE THEN latency_ms END), 0) as today_avg_latency,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN input_tokens END), 0) as today_input_tokens,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN output_tokens END), 0) as today_output_tokens,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_total,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_total
      FROM ai_usage_logs
    `);

    // From usage_daily table (primary source)
    const dailyStats = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN reply_count END), 0) as today_replies,
        COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN reply_count END), 0) as week_replies,
        COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN reply_count END), 0) as month_replies,
        COALESCE(SUM(reply_count), 0) as total_replies
      FROM usage_daily
    `);

    const logs = logsStats.rows[0];
    const daily = dailyStats.rows[0];

    res.json({
      today: {
        total_requests: parseInt(daily.today_replies, 10) || parseInt(logs.today_total, 10),
        successful: parseInt(logs.today_success, 10),
        failed: parseInt(logs.today_failed, 10),
        avg_latency_ms: Math.round(parseFloat(logs.today_avg_latency) || 0),
        input_tokens: parseInt(logs.today_input_tokens, 10),
        output_tokens: parseInt(logs.today_output_tokens, 10),
      },
      last_7_days: {
        total_requests: parseInt(daily.week_replies, 10) || parseInt(logs.week_total, 10),
      },
      last_30_days: {
        total_requests: parseInt(daily.month_replies, 10) || parseInt(logs.month_total, 10),
      },
      all_time: {
        total_requests: parseInt(daily.total_replies, 10),
      },
    });
  } catch (err) {
    console.error("AI stats error:", err);
    res.status(500).json({ error: "Failed to get AI statistics" });
  }
});

// GET /admin/ai-usage/costs - Estimated AI costs
router.get("/costs", adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    // Groq pricing is very low, but let's estimate based on average token usage
    // Rough estimate: $0.05 per 1M input tokens, $0.08 per 1M output tokens for llama-3.3-70b
    const INPUT_COST_PER_1M = 0.05;
    const OUTPUT_COST_PER_1M = 0.08;

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN input_tokens END), 0) as today_input,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN output_tokens END), 0) as today_output,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN input_tokens END), 0) as week_input,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN output_tokens END), 0) as week_output,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN input_tokens END), 0) as month_input,
        COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN output_tokens END), 0) as month_output
      FROM ai_usage_logs
    `);

    const data = result.rows[0];

    const calculateCost = (input: number, output: number) => {
      return (
        (input / 1000000) * INPUT_COST_PER_1M +
        (output / 1000000) * OUTPUT_COST_PER_1M
      );
    };

    res.json({
      today: {
        input_tokens: parseInt(data.today_input, 10),
        output_tokens: parseInt(data.today_output, 10),
        estimated_cost_usd: calculateCost(
          parseInt(data.today_input, 10),
          parseInt(data.today_output, 10)
        ).toFixed(4),
      },
      last_7_days: {
        input_tokens: parseInt(data.week_input, 10),
        output_tokens: parseInt(data.week_output, 10),
        estimated_cost_usd: calculateCost(
          parseInt(data.week_input, 10),
          parseInt(data.week_output, 10)
        ).toFixed(4),
      },
      last_30_days: {
        input_tokens: parseInt(data.month_input, 10),
        output_tokens: parseInt(data.month_output, 10),
        estimated_cost_usd: calculateCost(
          parseInt(data.month_input, 10),
          parseInt(data.month_output, 10)
        ).toFixed(4),
      },
    });
  } catch (err) {
    console.error("AI costs error:", err);
    res.status(500).json({ error: "Failed to get AI cost estimates" });
  }
});

export default router;
