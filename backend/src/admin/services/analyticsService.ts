import {
  selectAiUsageMetricRows,
  selectDashboardAiStats,
  selectDashboardMrr,
  selectDashboardSubscriptionStats,
  selectDashboardTransactionStats,
  selectDashboardUsageToday,
  selectDashboardUserStats,
  selectRevenueMetricRows,
  selectUserGrowthRows,
} from "../repositories/analyticsRepository.js";

export async function getDashboardStats() {
  const [
    userStats,
    subscriptionStats,
    mrrResult,
    aiStats,
    usageToday,
    transactionStats,
  ] = await Promise.all([
    selectDashboardUserStats(),
    selectDashboardSubscriptionStats(),
    selectDashboardMrr(),
    selectDashboardAiStats(),
    selectDashboardUsageToday(),
    selectDashboardTransactionStats(),
  ]);

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
  const safeDays = Number.isFinite(days)
    ? Math.max(1, Math.min(365, Math.floor(days)))
    : 30;
  return selectUserGrowthRows(safeDays);
}

export async function getRevenueMetrics(days: number = 30) {
  const safeDays = Number.isFinite(days)
    ? Math.max(1, Math.min(365, Math.floor(days)))
    : 30;
  return selectRevenueMetricRows(safeDays);
}

export async function getAIUsageMetrics(days: number = 30) {
  const safeDays = Number.isFinite(days)
    ? Math.max(1, Math.min(365, Math.floor(days)))
    : 30;
  return selectAiUsageMetricRows(safeDays);
}
