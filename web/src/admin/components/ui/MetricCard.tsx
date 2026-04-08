import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  className?: string;
  children?: ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  trend = 'neutral',
  className = '',
  children,
}: MetricCardProps) {
  return (
    <div className={`admin-metric-card ${className}`.trim()}>
      <div className="admin-metric-label">{label}</div>
      <div className="admin-metric-value">{value}</div>
      {hint ? <div className={`admin-metric-hint ${trend}`}>{hint}</div> : null}
      {children}
    </div>
  );
}

export default MetricCard;
