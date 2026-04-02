import { useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, DashboardData } from '../services/adminApi';
import '../styles/admin.css';

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await adminApi.getDashboard();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-header">
          <div className="admin-skeleton admin-skeleton-title" />
        </div>
        <div className="admin-stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-stat-card">
              <div className="admin-skeleton" style={{ height: 16, width: 80, marginBottom: 8 }} />
              <div className="admin-skeleton" style={{ height: 32, width: 100 }} />
            </div>
          ))}
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

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-subtitle">Overview of your platform</p>
      </div>

      {/* User Stats */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Users</h2>
      <div className="admin-stats-grid" style={{ marginBottom: 32 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Total Users</div>
          <div className="admin-stat-card-value">{formatNumber(data.users.total)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Active Users</div>
          <div className="admin-stat-card-value">{formatNumber(data.users.active)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">New This Week</div>
          <div className="admin-stat-card-value">{formatNumber(data.users.new_this_week)}</div>
          <div className="admin-stat-card-change positive">
            +{data.users.new_today} today
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Banned</div>
          <div className="admin-stat-card-value">{data.users.banned}</div>
        </div>
      </div>

      {/* Subscription Stats */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Subscriptions</h2>
      <div className="admin-stats-grid" style={{ marginBottom: 32 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Free Users</div>
          <div className="admin-stat-card-value">{formatNumber(data.subscriptions.free)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Pro Monthly</div>
          <div className="admin-stat-card-value">{formatNumber(data.subscriptions.pro_monthly)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Pro Yearly</div>
          <div className="admin-stat-card-value">{formatNumber(data.subscriptions.pro_yearly)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">MRR</div>
          <div className="admin-stat-card-value">{formatCurrency(data.subscriptions.mrr)}</div>
        </div>
      </div>

      {/* AI Stats */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>AI Usage</h2>
      <div className="admin-stats-grid" style={{ marginBottom: 32 }}>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Requests Today</div>
          <div className="admin-stat-card-value">{formatNumber(data.ai.requests_today)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">This Month</div>
          <div className="admin-stat-card-value">{formatNumber(data.ai.requests_this_month)}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Avg Latency</div>
          <div className="admin-stat-card-value">{data.ai.avg_latency_ms}ms</div>
        </div>
      </div>

      {/* Transaction Stats */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Transactions</h2>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">Today</div>
          <div className="admin-stat-card-value">{formatCurrency(data.transactions.today.amount)}</div>
          <div className="admin-stat-card-change">
            {data.transactions.today.count} transactions
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card-label">This Month</div>
          <div className="admin-stat-card-value">{formatCurrency(data.transactions.this_month.amount)}</div>
          <div className="admin-stat-card-change">
            {data.transactions.this_month.count} transactions
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default Dashboard;
