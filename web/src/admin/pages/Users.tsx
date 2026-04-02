import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, User, PaginatedResponse } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import '../styles/admin.css';

export function Users() {
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    loadUsers();
  }, [page, status, plan]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getUsers({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
        plan: plan || undefined,
      });
      setData(result);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load users', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Users</h1>
        <p className="admin-page-subtitle">Manage your platform users</p>
      </div>

      <div className="admin-card">
        {/* Filters */}
        <form onSubmit={handleSearch} className="admin-filter-bar">
          <input
            type="text"
            className="admin-input admin-search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
            <option value="banned">Banned</option>
          </select>
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
          <button type="submit" className="admin-btn admin-btn-secondary">
            Search
          </button>
        </form>

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
              <table className="admin-table admin-table-clickable">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Products</th>
                    <th>Total Replies</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((user) => (
                    <tr key={user.id} onClick={() => navigate(`/admin/users/${user.id}`)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="admin-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)' }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${user.plan === 'pro' ? 'admin-badge-info' : 'admin-badge-neutral'}`}>
                          {user.plan === 'pro' ? 'Pro' : 'Free'}
                        </span>
                      </td>
                      <td>{user.product_count || 0}</td>
                      <td>{user.total_replies || 0}</td>
                      <td>
                        <span className={`admin-badge ${user.banned_at ? 'admin-badge-error' : 'admin-badge-success'}`}>
                          {user.banned_at ? 'Banned' : 'Active'}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.pagination.total)} of {data.pagination.total} users
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
            <h3 className="admin-empty-state-title">No users found</h3>
            <p className="admin-empty-state-description">
              {search || status || plan
                ? 'Try adjusting your filters'
                : 'Users will appear here when they sign up'}
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Users;
