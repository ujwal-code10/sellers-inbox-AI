import { useState, useEffect } from 'react';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, SystemSetting } from '../services/adminApi';
import { useToast } from '../context/ToastContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../styles/admin.css';

export function Settings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const { addToast } = useToast();
  const { admin } = useAdminAuth();

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

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-header">
          <h1 className="admin-page-title">Settings</h1>
        </div>
        <div className="admin-card">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ marginBottom: 24 }}>
              <div className="admin-skeleton" style={{ height: 20, width: 150, marginBottom: 8 }} />
              <div className="admin-skeleton" style={{ height: 80 }} />
            </div>
          ))}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Settings</h1>
        <p className="admin-page-subtitle">
          System configuration {!isSuperAdmin && '(read-only for admins)'}
        </p>
      </div>

      <div className="admin-card">
        {settings.length > 0 ? (
          <div>
            {settings.map((setting) => (
              <div key={setting.key} style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--admin-color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                      {setting.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>
                    {setting.description && (
                      <p style={{ fontSize: 12, color: 'var(--admin-color-text-secondary)', margin: '4px 0 0' }}>
                        {setting.description}
                      </p>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--admin-color-text-muted)' }}>
                    Updated: {formatDate(setting.updated_at)}
                  </div>
                </div>

                <textarea
                  className="admin-input"
                  style={{ fontFamily: 'var(--admin-font-mono)', minHeight: 100, resize: 'vertical' }}
                  value={editValues[setting.key] || ''}
                  onChange={(e) => setEditValues({ ...editValues, [setting.key]: e.target.value })}
                  disabled={!isSuperAdmin}
                />

                {isSuperAdmin && (
                  <div style={{ marginTop: 8 }}>
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
