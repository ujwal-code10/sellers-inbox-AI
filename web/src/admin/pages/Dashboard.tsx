import { CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, DashboardData, Transaction } from '../services/adminApi';
import { MetricCard, SectionHeader, Sparkline } from '../components/ui';
import '../styles/admin.css';

interface AttentionState {
  pendingApprovals: number;
  expiringSoon: number;
  failedToday: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

function normalizeTrend(values: number[]): number[] {
  if (!values.length) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  return values;
}

function normalizeSeries(values: number[]): number[] {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 0.5);
  }

  return values.map((value) => (value - min) / (max - min));
}

function buildLinePath(values: number[]): string {
  if (!values.length) {
    return '';
  }

  const normalized = normalizeSeries(values);
  const maxIndex = Math.max(normalized.length - 1, 1);

  return normalized
    .map((point, index) => {
      const x = (index / maxIndex) * 100;
      const y = 92 - point * 72;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildAreaPath(values: number[]): string {
  const linePath = buildLinePath(values);
  if (!linePath) {
    return '';
  }

  return `${linePath} L100 95 L0 95 Z`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function transactionStatusBadge(status: string): string {
  switch (status) {
    case 'completed':
      return 'admin-badge-success';
    case 'pending':
      return 'admin-badge-warning';
    case 'failed':
    case 'rejected':
      return 'admin-badge-error';
    default:
      return 'admin-badge-neutral';
  }
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

interface TrendPanelChartProps {
  revenue: number[];
  volume: number[];
}

function TrendPanelChart({ revenue, volume }: TrendPanelChartProps) {
  const revenuePath = buildLinePath(revenue);
  const volumePath = buildLinePath(volume);
  const areaPath = buildAreaPath(revenue);

  if (!revenuePath && !volumePath) {
    return <div className="admin-trend-chart-empty">No trend data available yet</div>;
  }

  return (
    <div className="admin-trend-chart-frame">
      <svg className="admin-trend-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="admin-trend-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(29, 158, 117, 0.35)" />
            <stop offset="100%" stopColor="rgba(29, 158, 117, 0.02)" />
          </linearGradient>
        </defs>
        {areaPath ? <path className="admin-trend-area" d={areaPath} fill="url(#admin-trend-revenue-fill)" /> : null}
        {volumePath ? <path className="admin-trend-path admin-trend-path-volume" d={volumePath} /> : null}
        {revenuePath ? <path className="admin-trend-path admin-trend-path-revenue" d={revenuePath} /> : null}
      </svg>
    </div>
  );
}

export function Dashboard() {
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
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [aiUsageStats, setAiUsageStats] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setError('');
    setLoading(true);

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
      ] =
        await Promise.all([
          adminApi.getDashboard(),
          adminApi.getUserGrowth(14),
          adminApi.getRevenueMetrics(14),
          adminApi.getAIMetrics(14),
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
            limit: 5,
          }),
        ]);

      setData(overview);
      setUserTrend(normalizeTrend(userGrowth.data.map((entry) => Number(entry.count) || 0)));
      setRevenueTrend(normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.amount) || 0)));
      setRevenueCountTrend(normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.count) || 0)));
      setAiTrend(normalizeTrend(aiMetrics.data.map((entry) => Number(entry.total_requests) || 0)));
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
        failedToday: Number(aiUsageStatsResult?.today?.failed) || 0,
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <AdminLayout>
        <div className="admin-empty-state">
          <h3 className="admin-empty-state-title">Error loading dashboard</h3>
          <p className="admin-empty-state-description">{error}</p>
          <button className="admin-btn admin-btn-primary" onClick={loadDashboard}>
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const proUsers = data.subscriptions.pro_monthly + data.subscriptions.pro_yearly;
  const aiTodayTotal = Number(aiUsageStats?.today?.total_requests) || data.ai.requests_today;
  const aiTodaySuccess = Number(aiUsageStats?.today?.successful) || Math.max(aiTodayTotal - attention.failedToday, 0);
  const aiLast30Days = Number(aiUsageStats?.last_30_days?.total_requests) || data.ai.requests_this_month;
  const aiLast7Days = Number(aiUsageStats?.last_7_days?.total_requests) || 0;
  const aiLatency = Number(aiUsageStats?.today?.avg_latency_ms) || data.ai.avg_latency_ms;
  const aiSuccessRate = aiTodayTotal > 0 ? Math.round((aiTodaySuccess / aiTodayTotal) * 100) : 100;
  const aiTrendStatus: 'positive' | 'negative' | 'neutral' =
    aiSuccessRate >= 97 ? 'positive' : aiSuccessRate >= 90 ? 'neutral' : 'negative';
  const aiHealthBarStyle: CSSProperties = {
    width: `${Math.max(0, Math.min(100, aiSuccessRate))}%`,
  };
  const actionQueue = attention.pendingApprovals + attention.expiringSoon + attention.failedToday;

  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} at ${lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '--';

  return (
    <AdminLayout>
      <div className="admin-command-header">
        <div className="admin-command-header-row">
          <div>
            <p className="admin-command-eyebrow">Admin Operations</p>
            <h1 className="admin-command-title">Command Center</h1>
            <p className="admin-command-meta">Last synced {lastUpdatedLabel}</p>
          </div>

          <div className="admin-command-header-actions">
            <Link to="/admin/transactions" className="admin-btn admin-btn-secondary admin-btn-sm">
              Open Transactions
            </Link>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={loadDashboard}>
              Refresh Data
            </button>
          </div>
        </div>

        <div className="admin-command-strip">
          <span className={`admin-command-pulse ${actionQueue > 0 ? 'alert' : 'ok'}`} aria-hidden="true" />
          <span>
            {actionQueue > 0
              ? `${actionQueue} items need review across payments, renewals, or AI reliability.`
              : 'No urgent blockers right now. Monitoring remains healthy.'}
          </span>
        </div>
      </div>

      <section className="admin-section">
        <div className="admin-kpi-grid admin-kpi-grid-command">
          <MetricCard
            label="Revenue Today"
            value={formatCurrency(data.transactions.today.amount)}
            hint={`${data.transactions.today.count} successful payments`}
            trend="positive"
          >
            <Sparkline points={revenueTrend} />
          </MetricCard>

          <MetricCard label="MRR" value={formatCurrency(data.subscriptions.mrr)} hint={`${formatNumber(proUsers)} active Pro accounts`}>
            <Sparkline points={revenueCountTrend} colorClass="admin-sparkline-volume" />
          </MetricCard>

          <MetricCard
            label="Active Users"
            value={formatNumber(data.users.active)}
            hint={`${formatNumber(data.users.new_this_week)} joined this week`}
          >
            <Sparkline points={userTrend} />
          </MetricCard>

          <MetricCard
            label="AI Success Rate"
            value={`${aiSuccessRate}%`}
            hint={`${attention.failedToday} failed today`}
            trend={aiTrendStatus}
          >
            <Sparkline points={aiTrend} />
          </MetricCard>
        </div>
      </section>

      <div className="admin-command-grid">
        <section className="admin-command-chart-card">
          <SectionHeader
            title="Revenue and Payment Trend"
            subtitle="Normalized 14-day movement for revenue and transaction volume"
          />
          <TrendPanelChart revenue={revenueTrend} volume={revenueCountTrend} />
          <div className="admin-command-chart-legend">
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch revenue" /> Revenue
            </span>
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch volume" /> Transaction count
            </span>
          </div>
        </section>

        <div className="admin-command-side-stack">
          <section className="admin-attention-panel">
            <SectionHeader
              title="Attention Required"
              subtitle="Items that can affect renewals or trust"
            />

            <div className="admin-attention-grid">
              <div className="admin-attention-item warning">
                <div className="admin-attention-label">Pending manual approvals</div>
                <div className="admin-attention-value">{attention.pendingApprovals}</div>
                <div className="admin-attention-meta">Requires payment verification</div>
              </div>
              <div className="admin-attention-item info">
                <div className="admin-attention-label">Pro plans expiring in 7 days</div>
                <div className="admin-attention-value">{attention.expiringSoon}</div>
                <div className="admin-attention-meta">Follow up for renewals</div>
              </div>
              <div className={`admin-attention-item ${attention.failedToday > 0 ? 'critical' : 'info'}`}>
                <div className="admin-attention-label">AI failures today</div>
                <div className="admin-attention-value">{attention.failedToday}</div>
                <div className="admin-attention-meta">Investigate spikes before users report</div>
              </div>
            </div>
          </section>

          <aside className="admin-quick-actions">
            <SectionHeader title="Quick Actions" subtitle="Most common admin workflows" />
            <div className="admin-quick-actions-list">
              <Link to="/admin/transactions?status=pending" className="admin-quick-action-link">
                <span>Review pending transactions</span>
                <strong>{attention.pendingApprovals}</strong>
              </Link>
              <Link to="/admin/subscriptions" className="admin-quick-action-link">
                <span>Check expiring subscriptions</span>
                <strong>{attention.expiringSoon}</strong>
              </Link>
              <Link to="/admin/ai-usage" className="admin-quick-action-link">
                <span>Inspect AI reliability logs</span>
                <strong>{attention.failedToday}</strong>
              </Link>
              <Link to="/admin/users" className="admin-quick-action-link">
                <span>Manage user accounts</span>
                <strong>{formatNumber(data.users.total)}</strong>
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <div className="admin-command-bottom-grid">
        <section className="admin-command-transactions">
          <SectionHeader
            title="Recent Transactions"
            subtitle="Latest payment events across all methods"
            actions={(
              <Link to="/admin/transactions" className="admin-btn admin-btn-secondary admin-btn-sm">
                View all
              </Link>
            )}
          />

          {recentTransactions.length > 0 ? (
            <div className="admin-command-table-wrapper">
              <table className="admin-command-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <div className="admin-command-table-title">
                          {transaction.user_name || transaction.user_email || `User #${transaction.user_id ?? '--'}`}
                        </div>
                        <div className="admin-command-table-subtitle">{transaction.type}</div>
                      </td>
                      <td>{formatCurrency(Number(transaction.amount) || 0)}</td>
                      <td>{paymentMethodLabel(transaction.payment_method)}</td>
                      <td>
                        <span className={`admin-badge ${transactionStatusBadge(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td>{formatTimestamp(transaction.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">
              <h3 className="admin-empty-state-title">No transactions yet</h3>
              <p className="admin-empty-state-description">Recent payment activity will appear here.</p>
            </div>
          )}
        </section>

        <section className="admin-command-health-card">
          <SectionHeader
            title="AI Health Monitor"
            subtitle="Reliability and latency for current traffic"
          />

          <div className="admin-health-score-row">
            <div className="admin-health-score">
              <div className="admin-health-score-value">{aiSuccessRate}%</div>
              <div className="admin-health-score-label">Successful responses today</div>
            </div>

            <div className="admin-health-meter">
              <div className="admin-health-meter-track">
                <div className={`admin-health-meter-fill ${aiTrendStatus}`} style={aiHealthBarStyle} />
              </div>
              <div className="admin-health-meter-caption">
                {aiTodaySuccess} of {aiTodayTotal} requests succeeded
              </div>
            </div>
          </div>

          <div className="admin-health-grid">
            <div className="admin-health-cell">
              <span>Failed today</span>
              <strong>{attention.failedToday}</strong>
            </div>
            <div className="admin-health-cell">
              <span>Avg latency</span>
              <strong>{aiLatency} ms</strong>
            </div>
            <div className="admin-health-cell">
              <span>Last 7 days</span>
              <strong>{formatNumber(aiLast7Days)}</strong>
            </div>
            <div className="admin-health-cell">
              <span>Last 30 days</span>
              <strong>{formatNumber(aiLast30Days)}</strong>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

export default Dashboard;
