import { useState, useEffect } from 'react';
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
