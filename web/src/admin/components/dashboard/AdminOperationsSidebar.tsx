import { Link } from 'react-router-dom';
import { SectionHeader } from '../ui';

interface AdminOperationsSidebarProps {
  attention: {
    pendingApprovals: number;
    expiringSoon: number;
    failedToday: number;
  };
  isAllClear: boolean;
  attentionExpanded: boolean;
  pulseSeed: number;
  totalUsers: number;
  onToggleExpanded: () => void;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function AdminOperationsSidebar({
  attention,
  isAllClear,
  attentionExpanded,
  pulseSeed,
  totalUsers,
  onToggleExpanded,
}: AdminOperationsSidebarProps) {
  return (
    <div className="admin-command-side-stack">
      <section className="admin-attention-panel">
        <SectionHeader
          title="Action Required"
          subtitle="Items requiring immediate attention"
          actions={(
            <button
              type="button"
              className="admin-btn admin-btn-secondary admin-btn-sm"
              onClick={onToggleExpanded}
            >
              {attentionExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        />

        {isAllClear && !attentionExpanded ? (
          <div className="admin-all-clear-banner" role="status" aria-live="polite">
            <span className="admin-all-clear-icon" aria-hidden="true">✓</span>
            <span>All Clear! No action items at this time.</span>
          </div>
        ) : (
          <>
            {isAllClear ? (
              <div className="admin-all-clear-inline">
                <span className="admin-all-clear-icon" aria-hidden="true">✓</span>
                <span>All systems operational • No critical issues</span>
              </div>
            ) : null}

            {attentionExpanded ? (
              <div className="admin-attention-grid">
                <div className="admin-attention-item warning">
                  <div className="admin-attention-label">Manual Approvals Pending</div>
                  <div key={`pending-${pulseSeed}`} className="admin-attention-value admin-count-bounce">
                    {attention.pendingApprovals}
                  </div>
                  <div className="admin-attention-meta">Payment Verification Required</div>
                </div>
                <div className="admin-attention-item info">
                  <div className="admin-attention-label">Pro Plans Expiring Soon</div>
                  <div key={`expiring-${pulseSeed}`} className="admin-attention-value admin-count-bounce">
                    {attention.expiringSoon}
                  </div>
                  <div className="admin-attention-meta">Renewal Follow-Up Required</div>
                </div>
                <div className={`admin-attention-item ${attention.failedToday > 0 ? 'critical' : 'info'}`}>
                  <div className="admin-attention-label">Failed AI Requests</div>
                  <div key={`failed-${pulseSeed}`} className="admin-attention-value admin-count-bounce">
                    {attention.failedToday}
                  </div>
                  <div className="admin-attention-meta">Monitor for Service Anomalies</div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <aside className="admin-quick-actions">
        <SectionHeader title="Common Tasks" subtitle="Frequently used actions" />
        <div className="admin-quick-actions-list">
          {[
            {
              to: '/admin/transactions?status=pending',
              label: 'Review Pending Transactions',
              value: attention.pendingApprovals,
            },
            {
              to: '/admin/subscriptions',
              label: 'Review Expiring Subscriptions',
              value: attention.expiringSoon,
            },
            {
              to: '/admin/ai-usage',
              label: 'View AI Performance Logs',
              value: attention.failedToday,
            },
            {
              to: '/admin/users',
              label: 'Manage User Accounts',
              value: totalUsers,
            },
          ].map((action, index) => (
            <Link
              key={action.label}
              to={action.to}
              className="admin-quick-action-link"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="admin-quick-action-label">
                <span>{action.label}</span>
                <span className="admin-quick-action-arrow" aria-hidden="true">→</span>
              </span>
              <strong key={`${action.label}-${pulseSeed}`} className="admin-quick-action-count">
                {formatNumber(action.value)}
              </strong>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
