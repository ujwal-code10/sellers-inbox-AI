import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, UserDetails as UserDetailsType } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<UserDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showGrantProModal, setShowGrantProModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [proDuration, setProDuration] = useState('1 month');
  const [proReason, setProReason] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    if (id) loadUser();
  }, [id]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getUser(parseInt(id!, 10));
      setData(result);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load user', message: err.message });
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      await adminApi.banUser(data.user.id, banReason);
      addToast({ type: 'success', title: 'User banned successfully' });
      setShowBanModal(false);
      setBanReason('');
      loadUser();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to ban user', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      await adminApi.unbanUser(data.user.id);
      addToast({ type: 'success', title: 'User unbanned successfully' });
      loadUser();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to unban user', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantPro = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      await adminApi.grantPro(data.user.id, proDuration, proReason);
      addToast({ type: 'success', title: 'Pro access granted successfully' });
      setShowGrantProModal(false);
      setProReason('');
      loadUser();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to grant Pro', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokePro = async () => {
    if (!data) return;
    setActionLoading(true);
    try {
      await adminApi.revokePro(data.user.id, 'Admin revoked');
      addToast({ type: 'success', title: 'Pro access revoked' });
      loadUser();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to revoke Pro', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-skeleton admin-skeleton-title" style={{ marginBottom: 24 }} />
        <div className="admin-card">
          <div className="admin-skeleton" style={{ height: 200 }} />
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const { user, stats, recent_transactions } = data;

  return (
    <AdminLayout>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">{user.name}</h1>
          <p className="admin-page-subtitle">{user.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user.plan !== 'pro' && (
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setShowGrantProModal(true)}
              disabled={actionLoading}
            >
              Grant Pro
            </button>
          )}
          {user.plan === 'pro' && (
            <button
              className="admin-btn admin-btn-secondary"
              onClick={handleRevokePro}
              disabled={actionLoading}
            >
              Revoke Pro
            </button>
          )}
          {user.banned_at ? (
            <button
              className="admin-btn admin-btn-secondary"
              onClick={handleUnban}
              disabled={actionLoading}
            >
              Unban
            </button>
          ) : (
            <button
              className="admin-btn admin-btn-danger"
              onClick={() => setShowBanModal(true)}
              disabled={actionLoading}
            >
              Ban
            </button>
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <span className={`admin-badge ${user.plan === 'pro' ? 'admin-badge-info' : 'admin-badge-neutral'}`}>
          {user.plan === 'pro' ? 'Pro' : 'Free'}
        </span>
        <span className={`admin-badge ${user.banned_at ? 'admin-badge-error' : 'admin-badge-success'}`}>
          {user.banned_at ? 'Banned' : 'Active'}
        </span>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* User Info */}
          <div className="admin-card">
            <h3 className="admin-card-title" style={{ marginBottom: 16 }}>User Information</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Email</div>
                <div>{user.email}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Joined</div>
                <div>{formatDate(user.created_at)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Subscription</div>
                <div>{user.plan || 'Free'} ({user.billing || 'N/A'})</div>
              </div>
              {user.expires_at && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Expires</div>
                  <div>{formatDate(user.expires_at)}</div>
                </div>
              )}
              {user.banned_at && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Banned At</div>
                    <div>{formatDate(user.banned_at)}</div>
                  </div>
                  {user.ban_reason && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Ban Reason</div>
                      <div>{user.ban_reason}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="admin-card">
            <h3 className="admin-card-title" style={{ marginBottom: 16 }}>Usage Statistics</h3>
            <div className="admin-stats-grid">
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Products</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.product_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Total Replies</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.total_replies}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>Today</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.replies_today}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', marginBottom: 4 }}>This Week</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{stats.replies_this_week}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="admin-card">
          {recent_transactions.length > 0 ? (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Method</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>#{tx.id}</td>
                      <td>{tx.type}</td>
                      <td>Rs. {tx.amount}</td>
                      <td>
                        <span className={`admin-badge ${
                          tx.status === 'completed' ? 'admin-badge-success' :
                          tx.status === 'failed' ? 'admin-badge-error' : 'admin-badge-warning'
                        }`}>
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
          ) : (
            <div className="admin-empty-state">
              <h3 className="admin-empty-state-title">No transactions</h3>
              <p className="admin-empty-state-description">This user has no transaction history</p>
            </div>
          )}
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="admin-modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Ban User</h2>
              <p className="admin-modal-description">
                Are you sure you want to ban {user.name}? They will no longer be able to use the platform.
              </p>
            </div>
            <div className="admin-modal-body">
              <div className="admin-input-group">
                <label className="admin-input-label">Reason (optional)</label>
                <input
                  type="text"
                  className="admin-input"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Enter ban reason..."
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setShowBanModal(false)}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-danger" onClick={handleBan} disabled={actionLoading}>
                {actionLoading ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grant Pro Modal */}
      {showGrantProModal && (
        <div className="admin-modal-overlay" onClick={() => setShowGrantProModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Grant Pro Access</h2>
              <p className="admin-modal-description">
                Grant Pro subscription to {user.name}
              </p>
            </div>
            <div className="admin-modal-body">
              <div className="admin-input-group">
                <label className="admin-input-label">Duration</label>
                <select
                  className="admin-select"
                  value={proDuration}
                  onChange={(e) => setProDuration(e.target.value)}
                >
                  <option value="1 week">1 Week</option>
                  <option value="1 month">1 Month</option>
                  <option value="3 months">3 Months</option>
                  <option value="1 year">1 Year</option>
                </select>
              </div>
              <div className="admin-input-group">
                <label className="admin-input-label">Reason (optional)</label>
                <input
                  type="text"
                  className="admin-input"
                  value={proReason}
                  onChange={(e) => setProReason(e.target.value)}
                  placeholder="e.g., Customer support, beta tester..."
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-secondary" onClick={() => setShowGrantProModal(false)}>
                Cancel
              </button>
              <button className="admin-btn admin-btn-primary" onClick={handleGrantPro} disabled={actionLoading}>
                {actionLoading ? 'Granting...' : 'Grant Pro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default UserDetails;
