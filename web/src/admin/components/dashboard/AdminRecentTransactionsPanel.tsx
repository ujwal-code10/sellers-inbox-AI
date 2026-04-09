import { Link } from 'react-router-dom';
import { Transaction } from '../../services/adminApi';
import { SectionHeader } from '../ui';

type TransactionSortKey = 'user' | 'amount' | 'method' | 'status' | 'created';

interface AdminRecentTransactionsPanelProps {
  transactions: Transaction[];
  onSort: (key: TransactionSortKey) => void;
  getSortIndicator: (key: TransactionSortKey) => string;
  onOpenTransaction: (id: number) => void;
}

function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function transactionStatusBadge(status: string): string {
  switch (status) {
    case 'completed':
      return 'admin-badge-success';
    case 'pending':
      return 'admin-badge-warning';
    case 'failed':
    case 'rejected':
      return 'admin-badge-error';
    default:
      return 'admin-badge-neutral';
  }
}

function paymentMethodLabel(method?: string): string {
  if (!method) {
    return '--';
  }

  return method
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 30 * 1000) {
    return 'Just now';
  }

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return formatTimestamp(value);
}

export default function AdminRecentTransactionsPanel({
  transactions,
  onSort,
  getSortIndicator,
  onOpenTransaction,
}: AdminRecentTransactionsPanelProps) {
  return (
    <section className="admin-command-transactions">
      <SectionHeader
        title="Recent Transactions"
        subtitle="Latest payment events across all methods"
        actions={(
          <Link to="/admin/transactions" className="admin-btn admin-btn-secondary admin-btn-sm">
            View all
          </Link>
        )}
      />

      {transactions.length > 0 ? (
        <div className="admin-command-table-wrapper">
          <table className="admin-command-table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="admin-command-table-sort-btn" onClick={() => onSort('user')}>
                    User {getSortIndicator('user')}
                  </button>
                </th>
                <th>
                  <button type="button" className="admin-command-table-sort-btn" onClick={() => onSort('amount')}>
                    Amount {getSortIndicator('amount')}
                  </button>
                </th>
                <th>
                  <button type="button" className="admin-command-table-sort-btn" onClick={() => onSort('method')}>
                    Method {getSortIndicator('method')}
                  </button>
                </th>
                <th>
                  <button type="button" className="admin-command-table-sort-btn" onClick={() => onSort('status')}>
                    Status {getSortIndicator('status')}
                  </button>
                </th>
                <th>
                  <button type="button" className="admin-command-table-sort-btn" onClick={() => onSort('created')}>
                    Created {getSortIndicator('created')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="admin-command-table-row-clickable"
                  onClick={() => onOpenTransaction(transaction.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenTransaction(transaction.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open transaction ${transaction.id}`}
                >
                  <td>
                    <div className="admin-command-table-title">
                      {transaction.user_name || transaction.user_email || `User #${transaction.user_id ?? '--'}`}
                    </div>
                    <div className="admin-command-table-subtitle">{transaction.type}</div>
                  </td>
                  <td>{formatCurrency(Number(transaction.amount) || 0)}</td>
                  <td>{paymentMethodLabel(transaction.payment_method)}</td>
                  <td>
                    <span className={`admin-badge ${transactionStatusBadge(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td>
                    <div className="admin-command-table-title">{formatRelativeTimestamp(transaction.created_at)}</div>
                    <div className="admin-command-table-subtitle">{formatTimestamp(transaction.created_at)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty-state">
          <h3 className="admin-empty-state-title">No transactions yet today</h3>
          <p className="admin-empty-state-description">New payment activity will appear here as it comes in.</p>
        </div>
      )}
    </section>
  );
}
