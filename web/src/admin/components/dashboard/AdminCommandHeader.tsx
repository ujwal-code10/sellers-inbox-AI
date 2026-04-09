import { Link } from 'react-router-dom';

interface AdminCommandHeaderProps {
  actionQueue: number;
  isRefreshing: boolean;
  lastUpdatedLabel: string;
  onRefresh: () => void;
}

export default function AdminCommandHeader({
  actionQueue,
  isRefreshing,
  lastUpdatedLabel,
  onRefresh,
}: AdminCommandHeaderProps) {
  return (
    <div className="admin-command-header">
      <div className="admin-command-header-row">
        <div>
          <p className="admin-command-eyebrow">Admin Operations</p>
          <h1 className="admin-command-title">Command Center</h1>
          <p className="admin-command-meta">Last updated {lastUpdatedLabel}</p>
        </div>

        <div className="admin-command-header-actions">
          <Link to="/admin/transactions" className="admin-btn admin-btn-secondary admin-btn-sm">
            Open Transactions
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <div className="admin-command-strip" role="status" aria-live="polite">
        <span className={`admin-command-pulse ${actionQueue > 0 ? 'alert' : 'ok'}`} aria-hidden="true" />
        <span>
          {actionQueue > 0
            ? `${actionQueue} items require immediate attention across payments, renewals, or AI performance.`
            : 'All systems operational • No critical issues'}
        </span>
      </div>
    </div>
  );
}
