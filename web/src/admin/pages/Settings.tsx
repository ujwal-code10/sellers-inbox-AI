import { FormEvent, useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, SystemSetting } from '../services/adminApi';
import { SectionHeader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/admin.css';

export function Settings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [emailForm, setEmailForm] = useState({
    currentPassword: '',
    newEmail: '',
  });
  const [createAdminForm, setCreateAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin' as 'admin' | 'super_admin',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const { addToast } = useToast();
  const { admin, logout } = useAdminAuth();

  const isSuperAdmin = admin?.role === 'super_admin';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getSettings();
      setSettings(result.settings);
      // Initialize edit values
      const values: Record<string, string> = {};
      result.settings.forEach((s) => {
        values[s.key] = JSON.stringify(s.value, null, 2);
      });
      setEditValues(values);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to load settings', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string) => {
    if (!isSuperAdmin) {
      addToast({ type: 'error', title: 'Permission denied', message: 'Only super admins can modify settings' });
      return;
    }

    setSaving(key);
    try {
      const value = JSON.parse(editValues[key]);
      await adminApi.updateSetting(key, value);
      addToast({ type: 'success', title: 'Setting updated successfully' });
      loadSettings();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        addToast({ type: 'error', title: 'Invalid JSON', message: 'Please enter valid JSON' });
      } else {
        addToast({ type: 'error', title: 'Failed to save setting', message: err.message });
      }
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast({ type: 'error', title: 'All password fields are required' });
      return;
    }

    if (newPassword.length < 8) {
      addToast({
        type: 'error',
        title: 'Weak password',
        message: 'New password must be at least 8 characters',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', title: 'Passwords do not match' });
      return;
    }

    setUpdatingPassword(true);
    try {
      const result = await adminApi.changePassword(currentPassword, newPassword);
      addToast({
        type: 'success',
        title: 'Password updated',
        message: result.message,
      });

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => {
        logout();
      }, 300);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Password change failed',
        message: err.message,
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleChangeEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { currentPassword, newEmail } = emailForm;

    if (!currentPassword || !newEmail.trim()) {
      addToast({ type: 'error', title: 'Current password and new email are required' });
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      addToast({ type: 'error', title: 'Please enter a valid email address' });
      return;
    }

    if (admin?.email && normalizedEmail === admin.email.toLowerCase()) {
      addToast({ type: 'error', title: 'New email must be different' });
      return;
    }

    setUpdatingEmail(true);
    try {
      const result = await adminApi.changeEmail(currentPassword, normalizedEmail);
      addToast({
        type: 'success',
        title: 'Email updated',
        message: result.message,
      });

      setEmailForm({ currentPassword: '', newEmail: '' });

      setTimeout(() => {
        logout();
      }, 300);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Email change failed',
        message: err.message,
      });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleCreateAdmin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      addToast({
        type: 'error',
        title: 'Permission denied',
        message: 'Only super admins can create admin users',
      });
      return;
    }

    const { name, email, password, confirmPassword, role } = createAdminForm;
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !normalizedEmail || !password || !confirmPassword) {
      addToast({ type: 'error', title: 'All fields are required' });
      return;
    }

    if (trimmedName.length < 2) {
      addToast({ type: 'error', title: 'Name must be at least 2 characters' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      addToast({ type: 'error', title: 'Please enter a valid email address' });
      return;
    }

    if (password.length < 12) {
      addToast({
        type: 'error',
        title: 'Weak password',
        message: 'Password must be at least 12 characters',
      });
      return;
    }

    if (password !== confirmPassword) {
      addToast({ type: 'error', title: 'Passwords do not match' });
      return;
    }

    setCreatingAdmin(true);
    try {
      const result = await adminApi.createAdminUser({
        name: trimmedName,
        email: normalizedEmail,
        password,
        role,
      });

      addToast({
        type: 'success',
        title: 'Admin user created',
        message: `${result.admin.name} (${result.admin.email}) has been added.`,
      });

      setCreateAdminForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'admin',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Admin creation failed',
        message: err.message,
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-header">
          <SectionHeader title="Settings" subtitle="System configuration" />
        </div>
        <div className="admin-card">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-settings-item">
              <div className="admin-skeleton admin-skeleton-block-sm" />
              <div className="admin-skeleton admin-skeleton-block-md" />
            </div>
          ))}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <SectionHeader
          title="Settings"
          subtitle={`System configuration ${!isSuperAdmin ? '(read-only for admins)' : ''}`}
          actions={(
            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadSettings}>
              Refresh
            </button>
          )}
        />
      </div>

      <div className="admin-grid-two admin-mb-6">
        <div className="admin-card">
          <h3 className="admin-card-title admin-card-title-spaced">Change Password</h3>
          <form onSubmit={handleChangePassword}>
            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="current-password">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                className="admin-input"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="new-password">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                className="admin-input"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                autoComplete="new-password"
                required
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="admin-input"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                autoComplete="new-password"
                required
              />
            </div>

            <div className="admin-section-actions admin-mt-2">
              <button
                type="submit"
                className="admin-btn admin-btn-primary admin-btn-sm"
                disabled={updatingPassword}
              >
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title admin-card-title-spaced">Change Email</h3>
          <form onSubmit={handleChangeEmail}>
            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="new-email">
                New Email
              </label>
              <input
                id="new-email"
                type="email"
                className="admin-input"
                value={emailForm.newEmail}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, newEmail: e.target.value })
                }
                autoComplete="email"
                required
              />
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="email-current-password">
                Current Password
              </label>
              <input
                id="email-current-password"
                type="password"
                className="admin-input"
                value={emailForm.currentPassword}
                onChange={(e) =>
                  setEmailForm({ ...emailForm, currentPassword: e.target.value })
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="admin-section-actions admin-mt-2">
              <button
                type="submit"
                className="admin-btn admin-btn-primary admin-btn-sm"
                disabled={updatingEmail}
              >
                {updatingEmail ? 'Updating...' : 'Update Email'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="admin-card admin-mb-6">
          <h3 className="admin-card-title admin-card-title-spaced">Create Admin User</h3>
          <p className="admin-settings-description">
            Provision new admin accounts here. Public admin signup remains disabled.
          </p>

          <form onSubmit={handleCreateAdmin}>
            <div className="admin-grid-two">
              <div className="admin-input-group">
                <label className="admin-input-label" htmlFor="create-admin-name">
                  Full Name
                </label>
                <input
                  id="create-admin-name"
                  type="text"
                  className="admin-input"
                  value={createAdminForm.name}
                  onChange={(e) => setCreateAdminForm({ ...createAdminForm, name: e.target.value })}
                  autoComplete="name"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label" htmlFor="create-admin-email">
                  Email
                </label>
                <input
                  id="create-admin-email"
                  type="email"
                  className="admin-input"
                  value={createAdminForm.email}
                  onChange={(e) => setCreateAdminForm({ ...createAdminForm, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="admin-grid-two">
              <div className="admin-input-group">
                <label className="admin-input-label" htmlFor="create-admin-password">
                  Temporary Password
                </label>
                <input
                  id="create-admin-password"
                  type="password"
                  className="admin-input"
                  value={createAdminForm.password}
                  onChange={(e) => setCreateAdminForm({ ...createAdminForm, password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label className="admin-input-label" htmlFor="create-admin-confirm-password">
                  Confirm Password
                </label>
                <input
                  id="create-admin-confirm-password"
                  type="password"
                  className="admin-input"
                  value={createAdminForm.confirmPassword}
                  onChange={(e) =>
                    setCreateAdminForm({ ...createAdminForm, confirmPassword: e.target.value })
                  }
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="admin-input-group">
              <label className="admin-input-label" htmlFor="create-admin-role">
                Role
              </label>
              <select
                id="create-admin-role"
                className="admin-select"
                value={createAdminForm.role}
                onChange={(e) =>
                  setCreateAdminForm({
                    ...createAdminForm,
                    role: e.target.value as 'admin' | 'super_admin',
                  })
                }
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="admin-section-actions admin-mt-2">
              <button
                type="submit"
                className="admin-btn admin-btn-primary admin-btn-sm"
                disabled={creatingAdmin}
              >
                {creatingAdmin ? 'Creating...' : 'Create Admin User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-card">
        {settings.length > 0 ? (
          <div>
            {settings.map((setting) => (
              <div key={setting.key} className="admin-settings-item">
                <div className="admin-settings-head">
                  <div>
                    <h3 className="admin-settings-key">
                      {setting.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>
                    {setting.description && (
                      <p className="admin-settings-description">
                        {setting.description}
                      </p>
                    )}
                  </div>
                  <div className="admin-settings-updated">
                    Updated: {formatDate(setting.updated_at)}
                  </div>
                </div>

                <textarea
                  className="admin-input admin-settings-textarea"
                  value={editValues[setting.key] || ''}
                  onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                  disabled={!isSuperAdmin}
                />

                {isSuperAdmin && (
                  <div className="admin-section-actions admin-mt-2">
                    <button
                      className="admin-btn admin-btn-primary admin-btn-sm"
                      onClick={() => handleSave(setting.key)}
                      disabled={saving === setting.key}
                    >
                      {saving === setting.key ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            <h3 className="admin-empty-state-title">No settings found</h3>
            <p className="admin-empty-state-description">
              System settings will appear here after running migrations
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default Settings;
