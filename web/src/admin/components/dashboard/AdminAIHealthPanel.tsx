import { CSSProperties } from 'react';
import { SectionHeader } from '../ui';

type TrendTone = 'positive' | 'negative' | 'neutral';

interface AdminAIHealthPanelProps {
  aiSuccessRateLabel: string;
  aiSnapshotTotal: number;
  aiSnapshotSuccess: number;
  aiSnapshotFailed: number;
  aiLatency: number;
  aiLast7Days: number;
  aiLast30Days: number;
  aiDeltaLabel: string;
  aiRequestTrendTone: TrendTone;
  aiTrendStatus: TrendTone;
  aiHealthBarStyle: CSSProperties;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function AdminAIHealthPanel({
  aiSuccessRateLabel,
  aiSnapshotTotal,
  aiSnapshotSuccess,
  aiSnapshotFailed,
  aiLatency,
  aiLast7Days,
  aiLast30Days,
  aiDeltaLabel,
  aiRequestTrendTone,
  aiTrendStatus,
  aiHealthBarStyle,
}: AdminAIHealthPanelProps) {
  return (
    <section className="admin-command-health-card">
      <SectionHeader title="AI Performance Monitor" subtitle="Real-time performance metrics" />

      <div className="admin-health-score-row">
        <div className="admin-health-score">
          <div className="admin-health-score-value">{aiSuccessRateLabel}</div>
          <div className="admin-health-score-label">Requests Processed Successfully</div>
        </div>

        <div className="admin-health-meter">
          <div className="admin-health-meter-track">
            <div className={`admin-health-meter-fill ${aiTrendStatus}`} style={aiHealthBarStyle} />
          </div>
          <div className="admin-health-meter-caption">
            {aiSnapshotTotal > 0
              ? `${aiSuccessRateLabel} • ${aiSnapshotSuccess}/${aiSnapshotTotal} requests succeeded today`
              : 'No AI requests processed today yet'}
          </div>
        </div>
      </div>

      <div className="admin-health-grid">
        <div className="admin-health-cell">
          <span>Failed Requests</span>
          <strong>{aiSnapshotFailed}</strong>
        </div>
        <div className="admin-health-cell">
          <span>Average Response Time</span>
          <strong>{Math.round(aiLatency)} ms</strong>
        </div>
        <div className="admin-health-cell">
          <span>7-Day Average</span>
          <strong>{formatNumber(aiLast7Days)}</strong>
        </div>
        <div className="admin-health-cell">
          <span>30-Day Average</span>
          <strong>{formatNumber(aiLast30Days)}</strong>
        </div>
        <div className="admin-health-cell">
          <span>AI Request Trend</span>
          <strong>{aiDeltaLabel}</strong>
        </div>
        <div className="admin-health-cell">
          <span>Status</span>
          <strong>
            {aiRequestTrendTone === 'positive'
              ? 'Stable'
              : aiRequestTrendTone === 'negative'
                ? 'Needs attention'
                : 'Monitoring'}
          </strong>
        </div>
      </div>
    </section>
  );
}
