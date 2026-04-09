import pool from "../../utils/db.js";

export async function selectDashboardUserStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN banned_at IS NULL THEN 1 END) as active,
      COUNT(CASE WHEN banned_at IS NOT NULL THEN 1 END) as banned,
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as new_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_this_week
    FROM users
  `);

  return result.rows[0];
}

export async function selectDashboardSubscriptionStats() {
  const result = await pool.query(`
    SELECT
      COUNT(CASE WHEN plan = 'free' OR plan IS NULL THEN 1 END) as free,
      COUNT(CASE WHEN plan = 'pro' AND billing = 'monthly' THEN 1 END) as pro_monthly,
      COUNT(CASE WHEN plan = 'pro' AND billing = 'yearly' THEN 1 END) as pro_yearly
    FROM subscriptions
    WHERE status = 'active'
  `);

  return result.rows[0];
}

export async function selectDashboardMrr() {
  const result = await pool.query(`
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

  return result.rows[0];
}

export async function selectDashboardAiStats() {
  const result = await pool.query(`
    SELECT
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as requests_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as requests_this_month,
      COALESCE(AVG(latency_ms), 0) as avg_latency_ms
    FROM ai_usage_logs
  `);

  return result.rows[0];
}

export async function selectDashboardUsageToday() {
  const result = await pool.query(`
    SELECT COALESCE(SUM(reply_count), 0) as total
    FROM usage_daily
    WHERE date = CURRENT_DATE
  `);

  return result.rows[0];
}

export async function selectDashboardTransactionStats() {
  const result = await pool.query(`
    SELECT
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as count_today,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND status = 'completed' THEN amount ELSE 0 END), 0) as amount_today,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as count_this_month,
      COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed' THEN amount ELSE 0 END), 0) as amount_this_month
    FROM transactions
  `);

  return result.rows[0];
}

export async function selectUserGrowthRows(days: number) {
  const result = await pool.query(
    `SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM users
    WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date`,
    [days]
  );

  return result.rows;
}

export async function selectRevenueMetricRows(days: number) {
  const result = await pool.query(
    `SELECT
      DATE(created_at) as date,
      SUM(amount) as amount,
      COUNT(*) as count
    FROM transactions
    WHERE status = 'completed'
      AND created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    GROUP BY DATE(created_at)
    ORDER BY date`,
    [days]
  );

  return result.rows;
}

export async function selectAiUsageMetricRows(days: number) {
  const result = await pool.query(
    `SELECT
      date,
      SUM(reply_count) as total_requests
    FROM usage_daily
    WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
    GROUP BY date
    ORDER BY date`,
    [days]
  );

  return result.rows;
}