import pool from "../../utils/db.js";

export async function getDashboardStats() {
  // User stats
  const userStats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN banned_at IS NULL THEN 1 END) as active,
      COUNT(CASE WHEN banned_at IS NOT NULL THEN 1 END) as banned,
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as new_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_this_week
    FROM users
  `);

  // Subscription stats
  const subscriptionStats = await pool.query(`
    SELECT
      COUNT(CASE WHEN plan = 'free' OR plan IS NULL THEN 1 END) as free,
      COUNT(CASE WHEN plan = 'pro' AND billing = 'monthly' THEN 1 END) as pro_monthly,
      COUNT(CASE WHEN plan = 'pro' AND billing = 'yearly' THEN 1 END) as pro_yearly
    FROM subscriptions
    WHERE status = 'active'
  `);

  // Calculate MRR (Monthly Recurring Revenue)
  const mrrResult = await pool.query(`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN billing = 'monthly' THEN 299
          WHEN billing = 'yearly' THEN ROUND(2499.0 / 12, 2)
          ELSE 0
        END
      ), 0) as mrr
    FROM subscriptions
    WHERE plan = 'pro' AND status = 'active'
  `);

  // AI usage stats
  const aiStats = await pool.query(`
    SELECT
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as requests_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as requests_this_month,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms
    FROM ai_usage_logs
  `);

  // Today's usage from usage_daily
  const usageToday = await pool.query(`
    SELECT COALESCE(SUM(reply_count), 0) as total
    FROM usage_daily
    WHERE date = CURRENT_DATE
  `);

  // Transaction stats
  const transactionStats = await pool.query(`
    SELECT
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as count_today,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'completed' THEN amount ELSE 0 END), 0) as amount_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as count_this_month,
      COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed' THEN amount ELSE 0 END), 0) as amount_this_month
    FROM transactions
  `);

  return {
    users: {
      total: parseInt(userStats.rows[0].total, 10),
      active: parseInt(userStats.rows[0].active, 10),
      banned: parseInt(userStats.rows[0].banned, 10),
      new_today: parseInt(userStats.rows[0].new_today, 10),
      new_this_week: parseInt(userStats.rows[0].new_this_week, 10),
    },
    subscriptions: {
      free: parseInt(subscriptionStats.rows[0].free, 10),
      pro_monthly: parseInt(subscriptionStats.rows[0].pro_monthly, 10),
      pro_yearly: parseInt(subscriptionStats.rows[0].pro_yearly, 10),
      mrr: parseFloat(mrrResult.rows[0].mrr),
    },
    ai: {
      requests_today: parseInt(usageToday.rows[0].total, 10),
      requests_this_month: parseInt(aiStats.rows[0].requests_this_month, 10),
      avg_latency_ms: Math.round(parseFloat(aiStats.rows[0].avg_latency_ms) || 0),
    },
    transactions: {
      today: {
        count: parseInt(transactionStats.rows[0].count_today, 10),
        amount: parseFloat(transactionStats.rows[0].amount_today),
      },
      this_month: {
        count: parseInt(transactionStats.rows[0].count_this_month, 10),
        amount: parseFloat(transactionStats.rows[0].amount_this_month),
      },
    },
  };
}

export async function getUserGrowth(days: number = 30) {
  const result = await pool.query(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users
    WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date`
  );
  return result.rows;
}

export async function getRevenueMetrics(days: number = 30) {
  const result = await pool.query(
    `SELECT
      DATE(created_at) as date,
      SUM(amount) as amount,
      COUNT(*) as count
    FROM transactions
    WHERE status = 'completed'
      AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date`
  );
  return result.rows;
}

export async function getAIUsageMetrics(days: number = 30) {
  const result = await pool.query(
    `SELECT
      date,
      SUM(reply_count) as total_requests
    FROM usage_daily
    WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY date
    ORDER BY date`
  );
  return result.rows;
}
