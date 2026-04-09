import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import AdminAIHealthPanel from '../components/dashboard/AdminAIHealthPanel';
import { adminApi, DashboardData, Transaction } from '../services/adminApi';
import AdminCommandHeader from '../components/dashboard/AdminCommandHeader';
import AdminOperationsSidebar from '../components/dashboard/AdminOperationsSidebar';
import AdminRecentTransactionsPanel from '../components/dashboard/AdminRecentTransactionsPanel';
import TrendPanelChart from '../components/dashboard/TrendPanelChart';
import { MetricCard, SectionHeader, Sparkline } from '../components/ui';
import '../styles/admin.css';

interface AttentionState {
  pendingApprovals: number;
  expiringSoon: number;
  failedToday: number;
}

type TrendTone = 'positive' | 'negative' | 'neutral';
type TimeRangeOption = 1 | 7 | 30 | 90;
type TransactionSortKey = 'user' | 'amount' | 'method' | 'status' | 'created';

type TransactionSortState = {
  key: TransactionSortKey;
  direction: 'asc' | 'desc';
};

const RANGE_OPTIONS: Array<{ label: string; value: TimeRangeOption }> = [
  { label: 'Today', value: 1 },
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function normalizeTrend(values: number[]): number[] {
  if (!values.length) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  return values;
}

function toPositiveNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function calculateDelta(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const previous = Number(values[values.length - 2]) || 0;
  const current = Number(values[values.length - 1]) || 0;

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function getTrendTone(delta: number | null): TrendTone {
  if (delta === null) {
    return 'neutral';
  }

  if (delta > 0.1) {
    return 'positive';
  }

  if (delta < -0.1) {
    return 'negative';
  }

  return 'neutral';
}

function formatDeltaCopy(delta: number | null, baseline: string = 'vs previous day'): string {
  if (delta === null) {
    return `No change data yet • ${baseline}`;
  }

  const direction = delta >= 0 ? 'up' : 'down';
  const arrow = delta >= 0 ? '↑' : '↓';
  const absValue = Math.abs(delta);
  const rounded = Math.round(absValue * 10) / 10;
  const valueLabel = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);

  return `${arrow} ${valueLabel}% ${direction} • ${baseline}`;
}

function formatTrendDateLabel(value?: string): string {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function normalizeAiSnapshot(
  aiUsageStats: any,
  fallbackTotal: number,
  fallbackFailed: number
): { total: number; success: number; failed: number; rate: number } {
  const total = Math.max(
    0,
    Math.round(toPositiveNumber(aiUsageStats?.today?.total_requests, fallbackTotal))
  );

  const providedSuccess = Number(aiUsageStats?.today?.successful);
  const hasProvidedSuccess = Number.isFinite(providedSuccess) && providedSuccess >= 0;

  const providedFailed = Number(aiUsageStats?.today?.failed);
  const hasProvidedFailed = Number.isFinite(providedFailed) && providedFailed >= 0;

  let success = hasProvidedSuccess
    ? Math.round(providedSuccess)
    : Math.max(
        0,
        total - Math.round(hasProvidedFailed ? providedFailed : Math.max(0, fallbackFailed))
      );

  success = Math.min(total, success);

  const failed = Math.max(0, total - success);
  const rawRate = total > 0 ? (success / total) * 100 : 100;
  const rate = Math.max(0, Math.min(100, rawRate));

  return { total, success, failed, rate };
}

function paymentMethodLabel(method?: string): string {
  if (!method) {
    return '--';
  }

  return method
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compareText(a: string, b: string, direction: 'asc' | 'desc') {
  const comparison = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? comparison : -comparison;
}

function compareNumber(a: number, b: number, direction: 'asc' | 'desc') {
  return direction === 'asc' ? a - b : b - a;
}

export function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [attention, setAttention] = useState<AttentionState>({
    pendingApprovals: 0,
    expiringSoon: 0,
    failedToday: 0,
  });
  const [userTrend, setUserTrend] = useState<number[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<number[]>([]);
  const [revenueCountTrend, setRevenueCountTrend] = useState<number[]>([]);
  const [aiTrend, setAiTrend] = useState<number[]>([]);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [aiUsageStats, setAiUsageStats] = useState<any>(null);
  const [trendRange, setTrendRange] = useState<TimeRangeOption>(7);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [error, setError] = useState('');
  const [attentionExpanded, setAttentionExpanded] = useState(true);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [transactionSort, setTransactionSort] = useState<TransactionSortState>({
    key: 'created',
    direction: 'desc',
  });

  async function loadDashboard(range: TimeRangeOption = trendRange, forceRefresh: boolean = false) {
    setError('');

    if (!data) {
      setLoading(true);
    } else if (forceRefresh || range !== trendRange) {
      setIsRefreshing(true);
    }

    try {
      const [
        overview,
        userGrowth,
        revenueMetrics,
        aiMetrics,
        pendingTransactions,
        activeSubscriptions,
        aiUsageStatsResult,
        recentTransactionsResult,
      ] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getUserGrowth(range),
        adminApi.getRevenueMetrics(range),
        adminApi.getAIMetrics(range),
        adminApi.getTransactions({
          page: 1,
          limit: 100,
          status: 'pending',
          type: 'subscription',
        }),
        adminApi.getSubscriptions({
          page: 1,
          limit: 200,
          plan: 'pro',
          status: 'active',
        }),
        adminApi.getAIUsageStats(),
        adminApi.getTransactions({
          page: 1,
          limit: 8,
        }),
      ]);

      const normalizedAi = normalizeAiSnapshot(aiUsageStatsResult, overview.ai.requests_today, 0);

      setData(overview);
      setUserTrend(normalizeTrend(userGrowth.data.map((entry) => Number(entry.count) || 0)));
      setRevenueTrend(normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.amount) || 0)));
      setRevenueCountTrend(
        normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.count) || 0))
      );
      setAiTrend(normalizeTrend(aiMetrics.data.map((entry) => Number(entry.total_requests) || 0)));
      setTrendLabels(revenueMetrics.data.map((entry) => formatTrendDateLabel(entry.date)));
      setRecentTransactions(recentTransactionsResult.data || []);
      setAiUsageStats(aiUsageStatsResult);

      const now = new Date();
      const expiringSoon = activeSubscriptions.data.filter((subscription) => {
        if (!subscription.expires_at) {
          return false;
        }

        const daysUntilExpiry =
          (new Date(subscription.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
      }).length;

      const pendingManualApprovals = pendingTransactions.data.filter(
        (transaction) =>
          transaction.status === 'pending' &&
          transaction.type === 'subscription' &&
          transaction.payment_method === 'manual_qr'
      ).length;

      setAttention({
        pendingApprovals: pendingManualApprovals,
        expiringSoon,
        failedToday: normalizedAi.failed,
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard(trendRange);
  }, [trendRange]);

  const actionQueue =
    attention.pendingApprovals + attention.expiringSoon + Math.max(0, attention.failedToday);
  const isAllClear = actionQueue === 0;

  useEffect(() => {
    setAttentionExpanded(!isAllClear);
  }, [isAllClear]);

  useEffect(() => {
    setPulseSeed((prev) => prev + 1);
  }, [attention.pendingApprovals, attention.expiringSoon, attention.failedToday]);

  const sortedRecentTransactions = useMemo(() => {
    const items = [...recentTransactions];

    items.sort((a, b) => {
      switch (transactionSort.key) {
        case 'user':
          return compareText(
            a.user_name || a.user_email || `User ${a.user_id || ''}`,
            b.user_name || b.user_email || `User ${b.user_id || ''}`,
            transactionSort.direction
          );
        case 'amount':
          return compareNumber(
            Number(a.amount) || 0,
            Number(b.amount) || 0,
            transactionSort.direction
          );
        case 'method':
          return compareText(
            paymentMethodLabel(a.payment_method),
            paymentMethodLabel(b.payment_method),
            transactionSort.direction
          );
        case 'status':
          return compareText(a.status || '', b.status || '', transactionSort.direction);
        case 'created':
        default:
          return compareNumber(
            new Date(a.created_at).getTime() || 0,
            new Date(b.created_at).getTime() || 0,
            transactionSort.direction
          );
      }
    });

    return items;
  }, [recentTransactions, transactionSort]);

  const handleSort = (key: TransactionSortKey) => {
    setTransactionSort((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'created' ? 'desc' : 'asc',
      };
    });
  };

  const getSortIndicator = (key: TransactionSortKey) => {
    if (transactionSort.key !== key) {
      return '↕';
    }

    return transactionSort.direction === 'asc' ? '↑' : '↓';
  };

  const handleExportTrendCsv = () => {
    const maxLength = Math.max(revenueTrend.length, revenueCountTrend.length);

    if (maxLength === 0) {
      return;
    }

    const rows: string[][] = [['Date', 'Revenue', 'Transaction Count']];

    for (let index = 0; index < maxLength; index += 1) {
      rows.push([
        trendLabels[index] || `Point ${index + 1}`,
        String(Math.round(revenueTrend[index] || 0)),
        String(Math.round(revenueCountTrend[index] || 0)),
      ]);
    }

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `seller-inbox-trend-${trendRange}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTrendPng = async () => {
    const chartSvg = document.getElementById('admin-revenue-trend-chart') as SVGSVGElement | null;

    if (!chartSvg) {
      setError('Chart not ready for export yet.');
      return;
    }

    setExportingPng(true);
    setError('');

    try {
      const serializer = new XMLSerializer();
      const serialized = serializer.serializeToString(chartSvg);
      const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to render chart image'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 680;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is not available in this browser.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png');
      });

      if (!pngBlob) {
        throw new Error('Could not generate PNG file.');
      }

      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `seller-inbox-trend-${trendRange}d.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to export chart as PNG.');
    } finally {
      setExportingPng(false);
    }
  };

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="admin-command-header">
          <div className="admin-skeleton admin-skeleton-title" />
          <div className="admin-skeleton admin-skeleton-action-row" />
        </div>
        <div className="admin-kpi-grid admin-kpi-grid-command">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-metric-card">
              <div className="admin-skeleton admin-skeleton-metric-label" />
              <div className="admin-skeleton admin-skeleton-metric-value" />
              <div className="admin-skeleton admin-skeleton-metric-trend" />
            </div>
          ))}
        </div>

        <div className="admin-command-grid">
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
          <div className="admin-command-side-stack">
            <div className="admin-attention-panel">
              <div className="admin-skeleton admin-skeleton-title" />
              <div className="admin-attention-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="admin-skeleton admin-skeleton-attention" />
                ))}
              </div>
            </div>
            <div className="admin-quick-actions">
              <div className="admin-skeleton admin-skeleton-title" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="admin-skeleton admin-skeleton-action-row" />
              ))}
            </div>
          </div>
        </div>

        <div className="admin-command-bottom-grid">
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return (
      <AdminLayout>
        <div className="admin-empty-state">
          <h3 className="admin-empty-state-title">Error loading dashboard</h3>
          <p className="admin-empty-state-description">{error}</p>
          <button className="admin-btn admin-btn-primary" onClick={() => loadDashboard(trendRange, true)}>
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return null;
  }

  const proUsers = data.subscriptions.pro_monthly + data.subscriptions.pro_yearly;

  const aiSnapshot = normalizeAiSnapshot(aiUsageStats, data.ai.requests_today, attention.failedToday);
  const aiSuccessRate = aiSnapshot.rate;
  const aiSuccessRateLabel = formatPercent(aiSuccessRate);

  const aiLast30Days = Number(aiUsageStats?.last_30_days?.total_requests) || data.ai.requests_this_month;
  const aiLast7Days = Number(aiUsageStats?.last_7_days?.total_requests) || 0;
  const aiLatency = Number(aiUsageStats?.today?.avg_latency_ms) || data.ai.avg_latency_ms;

  const aiTrendStatus: TrendTone =
    aiSuccessRate >= 95 ? 'positive' : aiSuccessRate >= 85 ? 'neutral' : 'negative';

  const aiHealthBarStyle: CSSProperties = {
    width: `${Math.max(0, Math.min(100, aiSuccessRate))}%`,
  };

  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} • ${lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '--';

  const revenueDelta = calculateDelta(revenueTrend);
  const mrrDelta = calculateDelta(revenueCountTrend);
  const usersDelta = calculateDelta(userTrend);
  const aiDelta = calculateDelta(aiTrend);

  const revenueTrendTone = getTrendTone(revenueDelta);
  const mrrTrendTone = getTrendTone(mrrDelta);
  const usersTrendTone = getTrendTone(usersDelta);
  const aiRequestTrendTone = getTrendTone(aiDelta);

  return (
    <AdminLayout>
      <AdminCommandHeader
        actionQueue={actionQueue}
        isRefreshing={isRefreshing}
        lastUpdatedLabel={lastUpdatedLabel}
        onRefresh={() => loadDashboard(trendRange, true)}
      />

      {error ? (
        <div className="admin-inline-error">
          <span>{error}</span>
        </div>
      ) : null}

      <section className="admin-section admin-kpi-surface">
        <div className="admin-kpi-grid admin-kpi-grid-command">
          <MetricCard
            label="Today's Revenue"
            icon="💰"
            valueNumber={data.transactions.today.amount}
            formatValue={(value) => formatCurrency(value)}
            comparison={formatDeltaCopy(revenueDelta)}
            hint={`${data.transactions.today.count} payment${data.transactions.today.count === 1 ? '' : 's'} processed`}
            trend={revenueTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/transactions')}
            delayMs={0}
          >
            <Sparkline points={revenueTrend} delayMs={0} />
          </MetricCard>

          <MetricCard
            label="MRR"
            icon="📊"
            valueNumber={data.subscriptions.mrr}
            formatValue={(value) => formatCurrency(value)}
            comparison={formatDeltaCopy(mrrDelta)}
            hint={`${formatNumber(proUsers)} active Pro subscriptions`}
            trend={mrrTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/subscriptions')}
            delayMs={80}
          >
            <Sparkline points={revenueCountTrend} colorClass="admin-sparkline-volume" delayMs={80} />
          </MetricCard>

          <MetricCard
            label="Active Users"
            icon="👥"
            valueNumber={data.users.active}
            formatValue={(value) => Math.round(value).toLocaleString()}
            comparison={formatDeltaCopy(usersDelta)}
            hint={`${formatNumber(data.users.new_this_week)} new this week`}
            trend={usersTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/users')}
            delayMs={160}
          >
            <Sparkline points={userTrend} delayMs={160} />
          </MetricCard>

          <MetricCard
            label="AI Request Success Rate"
            icon="🤖"
            valueNumber={aiSuccessRate}
            formatValue={(value) => formatPercent(Math.max(0, Math.min(100, value)))}
            comparison={
              aiSnapshot.total > 0
                ? `${aiSuccessRateLabel} • ${aiSnapshot.success}/${aiSnapshot.total} requests succeeded today`
                : 'No AI requests processed today'
            }
            hint={`${aiSnapshot.failed} failures today`}
            trend={aiTrendStatus}
            className={`admin-metric-card-ai admin-metric-card-ai-${aiTrendStatus}`}
            footer="View details →"
            onClick={() => navigate('/admin/ai-usage')}
            delayMs={240}
          >
            <Sparkline points={aiTrend} delayMs={240} />
          </MetricCard>
        </div>
      </section>

      <div className="admin-command-grid">
        <section className="admin-command-chart-card">
          <SectionHeader
            title="Revenue and Payment Trend"
            subtitle="Normalized movement for revenue and payment volume"
            actions={(
              <div className="admin-chart-actions">
                <div className="admin-range-toggle" role="tablist" aria-label="Trend range selector">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-range-toggle-btn ${trendRange === option.value ? 'active' : ''}`}
                      onClick={() => setTrendRange(option.value)}
                      role="tab"
                      aria-selected={trendRange === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="admin-chart-export-actions">
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleExportTrendCsv}>
                    Download CSV
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    onClick={handleExportTrendPng}
                    disabled={exportingPng}
                  >
                    {exportingPng ? 'Exporting...' : 'Download PNG'}
                  </button>
                </div>
              </div>
            )}
          />

          <TrendPanelChart
            chartId="admin-revenue-trend-chart"
            revenue={revenueTrend}
            volume={revenueCountTrend}
            labels={trendLabels}
          />

          <div className="admin-command-chart-legend">
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch revenue" /> Revenue
            </span>
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch volume" /> Transaction count
            </span>
          </div>
        </section>

        <AdminOperationsSidebar
          attention={attention}
          isAllClear={isAllClear}
          attentionExpanded={attentionExpanded}
          pulseSeed={pulseSeed}
          totalUsers={data.users.total}
          onToggleExpanded={() => setAttentionExpanded((previous) => !previous)}
        />
      </div>

      <div className="admin-command-bottom-grid">
        <AdminRecentTransactionsPanel
          transactions={sortedRecentTransactions}
          onSort={handleSort}
          getSortIndicator={getSortIndicator}
          onOpenTransaction={(id) => navigate(`/admin/transactions?focus=${id}`)}
        />

        <AdminAIHealthPanel
          aiSuccessRateLabel={aiSuccessRateLabel}
          aiSnapshotTotal={aiSnapshot.total}
          aiSnapshotSuccess={aiSnapshot.success}
          aiSnapshotFailed={aiSnapshot.failed}
          aiLatency={aiLatency}
          aiLast7Days={aiLast7Days}
          aiLast30Days={aiLast30Days}
          aiDeltaLabel={formatDeltaCopy(aiDelta, 'vs previous day')}
          aiRequestTrendTone={aiRequestTrendTone}
          aiTrendStatus={aiTrendStatus}
          aiHealthBarStyle={aiHealthBarStyle}
        />
      </div>
    </AdminLayout>
  );
}

export default Dashboard;
