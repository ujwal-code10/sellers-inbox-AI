import { useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, Transaction, PaginatedResponse } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function Transactions() {
  const [data, setData] = useState<PaginatedResponse<Transaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  useEffect(() => {
    loadTransactions();
  }, [page, status, type]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getTransactions({
        page,
        limit: 20,
        status: status || undefined,
        type: type || undefined,
      });
      setData(result);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load transactions', message: err.message });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'admin-badge-success';
      case 'failed':
        return 'admin-badge-error';
      case 'pending':
        return 'admin-badge-warning';
      case 'refunded':
        return 'admin-badge-info';
      default:
        return 'admin-badge-neutral';
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Transactions</h1>
        <p className="admin-page-subtitle">View all payment transactions</p>
      </div>

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
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            className="admin-select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="subscription">Subscription</option>
            <option value="refund">Refund</option>
            <option value="credit">Credit</option>
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
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((tx) => (
                    <tr key={tx.id}>
                      <td>#{tx.id}</td>
                      <td>
                        {tx.user_name ? (
                          <div>
                            <div style={{ fontWeight: 500 }}>{tx.user_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)' }}>
                              {tx.user_email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--admin-color-text-muted)' }}>Deleted user</span>
                        )}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>{tx.type}</td>
                      <td>Rs. {tx.amount}</td>
                      <td>
                        <span className={`admin-badge ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>{tx.payment_method || 'N/A'}</td>
                      <td>{formatDate(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total} transactions
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
            <h3 className="admin-empty-state-title">No transactions found</h3>
            <p className="admin-empty-state-description">
              {status || type ? 'Try adjusting your filters' : 'Transactions will appear here'}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Transactions;
