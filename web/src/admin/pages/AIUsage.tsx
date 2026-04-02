import { useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, AIUsageLog, PaginatedResponse } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function AIUsage() {
  const [data, setData] = useState<PaginatedResponse<AIUsageLog> | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [requestType, setRequestType] = useState('');
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  useEffect(() => {
    loadData();
  }, [page, status, requestType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsResult, statsResult] = await Promise.all([
        adminApi.getAIUsage({
          page,
          limit: 20,
          status: status || undefined,
          request_type: requestType || undefined,
        }),
        adminApi.getAIUsageStats(),
      ]);
      setData(logsResult);
      setStats(statsResult);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load AI usage', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">AI Usage</h1>
        <p className="admin-page-subtitle">Monitor AI request logs and statistics</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="admin-stats-grid" style={{ marginBottom: 24 }}>
          <div className="admin-stat-card">
            <div className="admin-stat-card-label">Today</div>
            <div className="admin-stat-card-value">{stats.today?.total_requests || 0}</div>
            {stats.today?.avg_latency_ms > 0 && (
              <div className="admin-stat-card-change">
                Avg latency: {stats.today.avg_latency_ms}ms
              </div>
            )}
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-card-label">Last 7 Days</div>
            <div className="admin-stat-card-value">{stats.last_7_days?.total_requests || 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-card-label">Last 30 Days</div>
            <div className="admin-stat-card-value">{stats.last_30_days?.total_requests || 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-card-label">All Time</div>
            <div className="admin-stat-card-value">{stats.all_time?.total_requests || 0}</div>
          </div>
        </div>
      )}

      <div className="admin-card">
        {/* Filters */}
        <div className="admin-filter-bar">
          <select
            className="admin-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select
            className="admin-select"
            value={requestType}
            onChange={(e) => {
              setRequestType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="suggest_reply">Reply</option>
            <option value="clarification">Clarification</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="admin-skeleton-table-row">
                <div className="admin-skeleton admin-skeleton-table-cell" />
                <div className="admin-skeleton admin-skeleton-table-cell" />
                <div className="admin-skeleton admin-skeleton-table-cell" />
                <div className="admin-skeleton admin-skeleton-table-cell" />
              </div>
            ))}
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>Tokens</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((log) => (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td>
                        {log.user_name ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{log.user_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)' }}>
                              {log.user_email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--admin-color-text-muted)' }}>User #{log.user_id}</span>
                        )}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{log.request_type.replace('_', ' ')}</td>
                      <td>
                        <span className={`admin-badge ${log.status === 'success' ? 'admin-badge-success' : 'admin-badge-error'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>{log.latency_ms ? `${log.latency_ms}ms` : 'N/A'}</td>
                      <td>
                        {log.input_tokens || log.output_tokens ? (
                          <span style={{ fontSize: 12 }}>
                            {log.input_tokens || 0} / {log.output_tokens || 0}
                          </span>
                        ) : 'N/A'}
                      </td>
                      <td>{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total} logs
              </div>
              <div className="admin-pagination-buttons">
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="admin-empty-state">
            <h3 className="admin-empty-state-title">No AI usage logs found</h3>
            <p className="admin-empty-state-description">
              AI usage logs will appear here when users generate replies
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AIUsage;
