import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, Subscription, PaginatedResponse } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

type ViewMode = 'table' | 'cards';

export function Subscriptions() {
  const [data, setData] = useState<PaginatedResponse<Subscription> | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [page, setPage] = useState(1);
  const { addToast } = useToast();

  useEffect(() => {
    loadSubscriptions();
  }, [page, plan, status]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getSubscriptions({
        page,
        limit: 20,
        plan: plan || undefined,
        status: status || undefined,
      });
      setData(result);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load subscriptions', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (dateStr?: string) => {
    if (!dateStr) return null;
    const today = new Date();
    const expiry = new Date(dateStr);
    const diffMs = expiry.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const subscriptions = data?.data || [];

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      const searchTerm = search.trim().toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (sub.user_name || '').toLowerCase().includes(searchTerm) ||
        (sub.user_email || '').toLowerCase().includes(searchTerm) ||
        String(sub.user_id).includes(searchTerm);

      const daysUntilExpiry = getDaysUntilExpiry(sub.expires_at);
      const isExpiringSoon =
        typeof daysUntilExpiry === 'number' &&
        daysUntilExpiry >= 0 &&
        daysUntilExpiry <= 7 &&
        sub.status === 'active';

      const matchesExpiring = !expiringOnly || isExpiringSoon;

      return matchesSearch && matchesExpiring;
    });
  }, [subscriptions, search, expiringOnly]);

  const stats = useMemo(() => {
    const total = subscriptions.length;
    const active = subscriptions.filter((s) => s.status === 'active').length;
    const pro = subscriptions.filter((s) => s.plan === 'pro').length;
    const expiringSoon = subscriptions.filter((s) => {
      const daysUntilExpiry = getDaysUntilExpiry(s.expires_at);
      return (
        typeof daysUntilExpiry === 'number' &&
        daysUntilExpiry >= 0 &&
        daysUntilExpiry <= 7 &&
        s.status === 'active'
      );
    }).length;

    return { total, active, pro, expiringSoon };
  }, [subscriptions]);

  const clearLocalFilters = () => {
    setSearch('');
    setExpiringOnly(false);
  };

  const getStatusBadgeClass = (subStatus: string) => {
    switch (subStatus) {
      case 'active':
        return 'admin-badge-success';
      case 'cancelled':
        return 'admin-badge-error';
      case 'expired':
        return 'admin-badge-warning';
      default:
        return 'admin-badge-neutral';
    }
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Subscriptions</h1>
        <p className="admin-page-subtitle">Manage user subscriptions</p>
      </div>

      <div className="admin-stats-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card admin-stat-card-interactive">
          <div className="admin-stat-card-label">Visible in page</div>
          <div className="admin-stat-card-value">{stats.total}</div>
          <div className="admin-stat-card-change">Current server page</div>
        </div>
        <button
          type="button"
          className="admin-stat-card admin-stat-card-interactive"
          onClick={() => {
            setStatus('active');
            setPage(1);
          }}
        >
          <div className="admin-stat-card-label">Active</div>
          <div className="admin-stat-card-value">{stats.active}</div>
          <div className="admin-stat-card-change positive">Tap to filter</div>
        </button>
        <button
          type="button"
          className="admin-stat-card admin-stat-card-interactive"
          onClick={() => {
            setPlan('pro');
            setPage(1);
          }}
        >
          <div className="admin-stat-card-label">Pro Plans</div>
          <div className="admin-stat-card-value">{stats.pro}</div>
          <div className="admin-stat-card-change">High-value cohort</div>
        </button>
        <button
          type="button"
          className="admin-stat-card admin-stat-card-interactive"
          onClick={() => setExpiringOnly((v) => !v)}
        >
          <div className="admin-stat-card-label">Expiring in 7 days</div>
          <div className="admin-stat-card-value">{stats.expiringSoon}</div>
          <div className={`admin-stat-card-change ${expiringOnly ? 'negative' : ''}`}>
            {expiringOnly ? 'Filter enabled' : 'Tap to focus'}
          </div>
        </button>
      </div>

      <div className="admin-card">
        {/* Filters */}
        <div className="admin-filter-bar">
          <input
            type="text"
            className="admin-input admin-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, email, or ID..."
          />
          <select
            className="admin-select"
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
          <select
            className="admin-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="button"
            className={`admin-btn ${expiringOnly ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
            onClick={() => setExpiringOnly((v) => !v)}
          >
            Expiring Soon
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={clearLocalFilters}
          >
            Clear Local
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={loadSubscriptions}
          >
            Refresh
          </button>
          <div className="admin-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`admin-view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`admin-view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              Cards
            </button>
          </div>
        </div>

        <div className="admin-results-summary">
          Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions on this page
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
        ) : data && filteredSubscriptions.length > 0 ? (
          <>
            {viewMode === 'table' ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Plan</th>
                      <th>Billing</th>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscriptions.map((sub) => {
                      const daysUntilExpiry = getDaysUntilExpiry(sub.expires_at);
                      const expiryLabel =
                        typeof daysUntilExpiry === 'number'
                          ? daysUntilExpiry < 0
                            ? `${Math.abs(daysUntilExpiry)}d ago`
                            : `${daysUntilExpiry}d left`
                          : null;

                      return (
                        <tr key={sub.id}>
                          <td>
                            {sub.user_name ? (
                              <div>
                                <div style={{ fontWeight: 500 }}>{sub.user_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)' }}>
                                  {sub.user_email}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--admin-color-text-muted)' }}>User #{sub.user_id}</span>
                            )}
                          </td>
                          <td>
                            <span className={`admin-badge ${sub.plan === 'pro' ? 'admin-badge-info' : 'admin-badge-neutral'}`}>
                              {sub.plan === 'pro' ? 'Pro' : 'Free'}
                            </span>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{sub.billing || 'N/A'}</td>
                          <td>
                            <span className={`admin-badge ${getStatusBadgeClass(sub.status)}`}>
                              {sub.status}
                            </span>
                          </td>
                          <td>{formatDate(sub.started_at)}</td>
                          <td>
                            <div>{formatDate(sub.expires_at)}</div>
                            {expiryLabel && (
                              <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)' }}>
                                {expiryLabel}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-subscription-grid">
                {filteredSubscriptions.map((sub) => {
                  const daysUntilExpiry = getDaysUntilExpiry(sub.expires_at);
                  const isUrgent = typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;

                  return (
                    <article key={sub.id} className="admin-subscription-card">
                      <div className="admin-subscription-card-top">
                        <div>
                          <h3>{sub.user_name || `User #${sub.user_id}`}</h3>
                          <p>{sub.user_email || 'No email available'}</p>
                        </div>
                        <span className={`admin-badge ${sub.plan === 'pro' ? 'admin-badge-info' : 'admin-badge-neutral'}`}>
                          {sub.plan === 'pro' ? 'Pro' : 'Free'}
                        </span>
                      </div>

                      <div className="admin-subscription-card-meta">
                        <div>
                          <span>Status</span>
                          <strong>
                            <span className={`admin-badge ${getStatusBadgeClass(sub.status)}`}>{sub.status}</span>
                          </strong>
                        </div>
                        <div>
                          <span>Billing</span>
                          <strong style={{ textTransform: 'capitalize' }}>{sub.billing || 'N/A'}</strong>
                        </div>
                        <div>
                          <span>Started</span>
                          <strong>{formatDate(sub.started_at)}</strong>
                        </div>
                        <div>
                          <span>Expires</span>
                          <strong>{formatDate(sub.expires_at)}</strong>
                        </div>
                      </div>

                      {typeof daysUntilExpiry === 'number' && (
                        <div className={`admin-subscription-expiry ${isUrgent ? 'urgent' : ''}`}>
                          {daysUntilExpiry < 0
                            ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                            : `${daysUntilExpiry} days until expiry`}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total} subscriptions
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
            <h3 className="admin-empty-state-title">No matching subscriptions</h3>
            <p className="admin-empty-state-description">
              {plan || status || search || expiringOnly
                ? 'Try adjusting your filters'
                : 'Subscriptions will appear here'}
            </p>
            {(search || expiringOnly) && (
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={clearLocalFilters}
              >
                Clear Search Filters
              </button>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Subscriptions;
