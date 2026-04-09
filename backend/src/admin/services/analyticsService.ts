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

function toInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function toFloat(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDashboardStats() {
  const [
    userStatsRow,
    subscriptionStatsRow,
    mrrRow,
    aiStatsRow,
    usageTodayRow,
    transactionStatsRow,
  ] = await Promise.all([
    selectDashboardUserStats(),
    selectDashboardSubscriptionStats(),
    selectDashboardMrr(),
    selectDashboardAiStats(),
    selectDashboardUsageToday(),
    selectDashboardTransactionStats(),
  ]);

  const userStats = userStatsRow ?? {};
  const subscriptionStats = subscriptionStatsRow ?? {};
  const mrrResult = mrrRow ?? {};
  const aiStats = aiStatsRow ?? {};
  const usageToday = usageTodayRow ?? {};
  const transactionStats = transactionStatsRow ?? {};

  return {
    users: {
      total: toInt((userStats as Record<string, unknown>).total),
      active: toInt((userStats as Record<string, unknown>).active),
      banned: toInt((userStats as Record<string, unknown>).banned),
      new_today: toInt((userStats as Record<string, unknown>).new_today),
      new_this_week: toInt((userStats as Record<string, unknown>).new_this_week),
    },
    subscriptions: {
      free: toInt((subscriptionStats as Record<string, unknown>).free),
      pro_monthly: toInt((subscriptionStats as Record<string, unknown>).pro_monthly),
      pro_yearly: toInt((subscriptionStats as Record<string, unknown>).pro_yearly),
      mrr: toFloat((mrrResult as Record<string, unknown>).mrr),
    },
    ai: {
      requests_today: toInt((usageToday as Record<string, unknown>).total),
      requests_this_month: toInt(
        (aiStats as Record<string, unknown>).requests_this_month
      ),
      avg_latency_ms: Math.round(
        toFloat((aiStats as Record<string, unknown>).avg_latency_ms)
      ),
    },
    transactions: {
      today: {
        count: toInt((transactionStats as Record<string, unknown>).count_today),
        amount: toFloat((transactionStats as Record<string, unknown>).amount_today),
      },
      this_month: {
        count: toInt((transactionStats as Record<string, unknown>).count_this_month),
        amount: toFloat(
          (transactionStats as Record<string, unknown>).amount_this_month
        ),
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
