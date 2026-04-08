import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, Transaction, PaginatedResponse } from '../services/adminApi';
import { SectionHeader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function Transactions() {
  const [data, setData] = useState<PaginatedResponse<Transaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<Transaction | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Transaction | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const { addToast } = useToast();

  const loadTransactions = useCallback(async (showLoader: boolean = true) => {
    if (showLoader) {
      setLoading(true);
    }
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
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [addToast, page, status, type]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTransactions(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadTransactions]);

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

  const isManualQrPending = (tx: Transaction) => {
    return (
      tx.status === 'pending' &&
      tx.type === 'subscription' &&
      tx.payment_method === 'manual_qr'
    );
  };

  const getBillingLabel = (tx: Transaction) => {
    const billing = tx.metadata?.billing;
    return billing === 'yearly' ? 'Yearly' : 'Monthly';
  };

  const closeApproveModal = () => {
    setApproveTarget(null);
    setReviewReason('');
  };

  const closeRejectModal = () => {
    setRejectTarget(null);
    setReviewReason('');
  };

  const handleApprove = async () => {
    if (!approveTarget) return;

    setActionLoading(true);
    try {
      const reason = reviewReason.trim();
      await adminApi.approveTransaction(approveTarget.id, reason || undefined);
      addToast({ type: 'success', title: 'Payment approved and Pro activated' });
      closeApproveModal();
      await loadTransactions();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to approve transaction', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;

    const reason = reviewReason.trim();
    if (reason.length < 3) {
      addToast({
        type: 'error',
        title: 'Reason required',
        message: 'Please provide at least 3 characters for rejection reason.',
      });
      return;
    }

    setActionLoading(true);
    try {
      await adminApi.rejectTransaction(rejectTarget.id, reason);
      addToast({ type: 'success', title: 'Payment request rejected' });
      closeRejectModal();
      await loadTransactions();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to reject transaction', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <SectionHeader
          title="Transactions"
          subtitle="View and verify payment activity"
          actions={(
            <button
              className="admin-btn admin-btn-secondary admin-btn-sm"
              type="button"
              onClick={() => loadTransactions()}
              disabled={loading || actionLoading}
            >
              Refresh
            </button>
          )}
        />
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
          <button
            className="admin-btn admin-btn-secondary"
            type="button"
            onClick={() => loadTransactions()}
            disabled={loading || actionLoading}
          >
            Refresh
          </button>
          <button
            className="admin-btn admin-btn-secondary"
            type="button"
            onClick={() => {
              setStatus('');
              setType('');
              setPage(1);
            }}
            disabled={loading || actionLoading}
          >
            Clear Filters
          </button>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((tx) => (
                    <tr key={tx.id}>
                      <td>#{tx.id}</td>
                      <td>
                        {tx.user_name ? (
                          <div>
                            <div className="admin-user-name">{tx.user_name}</div>
                            <div className="admin-user-email">{tx.user_email}</div>
                          </div>
                        ) : (
                          <span className="admin-muted">Deleted user</span>
                        )}
                      </td>
                      <td className="admin-capitalize">{tx.type}</td>
                      <td>Rs. {tx.amount}</td>
                      <td>
                        <span className={`admin-badge ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>{tx.payment_method || 'N/A'}</td>
                      <td>{formatDate(tx.created_at)}</td>
                      <td>
                        {isManualQrPending(tx) ? (
                          <div className="admin-flex-wrap">
                            <button
                              className="admin-btn admin-btn-primary admin-btn-sm"
                              onClick={() => {
                                setApproveTarget(tx);
                                setReviewReason('');
                              }}
                              disabled={actionLoading}
                            >
                              Approve
                            </button>
                            <button
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => {
                                setRejectTarget(tx);
                                setReviewReason('');
                              }}
                              disabled={actionLoading}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="admin-text-xs admin-muted">
                            No action
                          </span>
                        )}
                      </td>
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

      {approveTarget && (
        <div className="admin-modal-overlay" onClick={closeApproveModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Approve Manual QR Payment</h2>
              <p className="admin-modal-description">
                This will mark the transaction as completed and activate Pro access immediately.
              </p>
            </div>
            <div className="admin-modal-body">
              <div className="admin-kv-list">
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Transaction</span>
                  <strong className="admin-kv-value">#{approveTarget.id}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">User</span>
                  <strong className="admin-kv-value">{approveTarget.user_name || `User #${approveTarget.user_id || 'N/A'}`}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Amount</span>
                  <strong className="admin-kv-value">Rs. {approveTarget.amount}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Billing</span>
                  <strong className="admin-kv-value">{getBillingLabel(approveTarget)}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Reference</span>
                  <strong className="admin-kv-value">{approveTarget.payment_ref || 'N/A'}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Payer name</span>
                  <strong className="admin-kv-value">{String(approveTarget.metadata?.payer_name || 'N/A')}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Submitted note</span>
                  <strong className="admin-kv-value">{String(approveTarget.metadata?.note || 'N/A')}</strong>
                </div>
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">Approval note (optional)</label>
                <input
                  type="text"
                  className="admin-input"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Optional internal note for audit log"
                  maxLength={300}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={closeApproveModal} disabled={actionLoading}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-primary" onClick={handleApprove} disabled={actionLoading}>
                {actionLoading ? 'Approving...' : 'Approve and Activate Pro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="admin-modal-overlay" onClick={closeRejectModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Reject Manual QR Payment</h2>
              <p className="admin-modal-description">
                Rejection reason is required so the team and user can understand what to correct.
              </p>
            </div>
            <div className="admin-modal-body">
              <div className="admin-kv-list">
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Transaction</span>
                  <strong className="admin-kv-value">#{rejectTarget.id}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">User</span>
                  <strong className="admin-kv-value">{rejectTarget.user_name || `User #${rejectTarget.user_id || 'N/A'}`}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Reference</span>
                  <strong className="admin-kv-value">{rejectTarget.payment_ref || 'N/A'}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Payer name</span>
                  <strong className="admin-kv-value">{String(rejectTarget.metadata?.payer_name || 'N/A')}</strong>
                </div>
                <div className="admin-kv-row">
                  <span className="admin-kv-label">Submitted note</span>
                  <strong className="admin-kv-value">{String(rejectTarget.metadata?.note || 'N/A')}</strong>
                </div>
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label">Reason for rejection</label>
                <textarea
                  className="admin-input"
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Example: Amount mismatch, reference not visible, duplicate transfer"
                  rows={4}
                  maxLength={300}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={closeRejectModal} disabled={actionLoading}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-danger" onClick={handleReject} disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default Transactions;
