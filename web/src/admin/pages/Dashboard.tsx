import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { adminApi, DashboardData, Transaction } from '../services/adminApi';
import { MetricCard, SectionHeader, Sparkline } from '../components/ui';
import '../styles/admin.css';

interface AttentionState {
  pendingApprovals: number;
  expiringSoon: number;
  failedToday: number;
}

type TrendTone = 'positive' | 'negative' | 'neutral';
type TimeRangeOption = 1 | 7 | 30 | 90;
type TransactionSortKey = 'user' | 'amount' | 'method' | 'status' | 'created';

type TransactionSortState = {
  key: TransactionSortKey;
  direction: 'asc' | 'desc';
};

const RANGE_OPTIONS: Array<{ label: string; value: TimeRangeOption }> = [
  { label: 'Today', value: 1 },
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function normalizeTrend(values: number[]): number[] {
  if (!values.length) {
    return [0, 0, 0, 0, 0, 0, 0];
  }
  return values;
}

function normalizeSeries(values: number[]): number[] {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 0.5);
  }

  return values.map((value) => (value - min) / (max - min));
}

function toPositiveNumber(value: unknown, fallback: number = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function calculateDelta(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const previous = Number(values[values.length - 2]) || 0;
  const current = Number(values[values.length - 1]) || 0;

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function getTrendTone(delta: number | null): TrendTone {
  if (delta === null) {
    return 'neutral';
  }

  if (delta > 0.1) {
    return 'positive';
  }

  if (delta < -0.1) {
    return 'negative';
  }

  return 'neutral';
}

function formatDeltaCopy(delta: number | null, baseline: string = 'vs previous day'): string {
  if (delta === null) {
    return `No change data yet • ${baseline}`;
  }

  const direction = delta >= 0 ? 'up' : 'down';
  const arrow = delta >= 0 ? '↑' : '↓';
  const absValue = Math.abs(delta);
  const rounded = Math.round(absValue * 10) / 10;
  const valueLabel = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);

  return `${arrow} ${valueLabel}% ${direction} • ${baseline}`;
}

function formatTrendDateLabel(value?: string): string {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
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

function normalizeAiSnapshot(
  aiUsageStats: any,
  fallbackTotal: number,
  fallbackFailed: number
): { total: number; success: number; failed: number; rate: number } {
  const total = Math.max(
    0,
    Math.round(toPositiveNumber(aiUsageStats?.today?.total_requests, fallbackTotal))
  );

  const providedSuccess = Number(aiUsageStats?.today?.successful);
  const hasProvidedSuccess = Number.isFinite(providedSuccess) && providedSuccess >= 0;

  const providedFailed = Number(aiUsageStats?.today?.failed);
  const hasProvidedFailed = Number.isFinite(providedFailed) && providedFailed >= 0;

  let success = hasProvidedSuccess
    ? Math.round(providedSuccess)
    : Math.max(
        0,
        total - Math.round(hasProvidedFailed ? providedFailed : Math.max(0, fallbackFailed))
      );

  success = Math.min(total, success);

  const failed = Math.max(0, total - success);
  const rawRate = total > 0 ? (success / total) * 100 : 100;
  const rate = Math.max(0, Math.min(100, rawRate));

  return { total, success, failed, rate };
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

function compareText(a: string, b: string, direction: 'asc' | 'desc') {
  const comparison = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? comparison : -comparison;
}

function compareNumber(a: number, b: number, direction: 'asc' | 'desc') {
  return direction === 'asc' ? a - b : b - a;
}

function toSmoothPath(points: ChartPoint[]): string {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    const point = points[0];
    return `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  let path = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

interface TrendPanelChartProps {
  chartId: string;
  revenue: number[];
  volume: number[];
  labels: string[];
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

function TrendPanelChart({ chartId, revenue, volume, labels }: TrendPanelChartProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const pointCount = Math.max(revenue.length, volume.length);

  if (!pointCount) {
    return <div className="admin-trend-chart-empty">No trend data available yet</div>;
  }

  const revenueValues = Array.from({ length: pointCount }, (_, index) => Number(revenue[index] || 0));
  const volumeValues = Array.from({ length: pointCount }, (_, index) => Number(volume[index] || 0));

  const normalizedRevenue = normalizeSeries(revenueValues);
  const normalizedVolume = normalizeSeries(volumeValues);
  const maxIndex = Math.max(pointCount - 1, 1);
  const chartTop = 10;
  const chartBottom = 92;
  const chartHeight = chartBottom - chartTop;
  const volumeBarWidth = Math.max(2.2, Math.min(7, 72 / Math.max(pointCount, 1)));

  const revenuePoints: ChartPoint[] = normalizedRevenue.map((point, index) => ({
    x: (index / maxIndex) * 100,
    y: chartBottom - point * (chartHeight - 6),
    value: revenueValues[index],
  }));

  const volumeBars = normalizedVolume.map((point, index) => {
    const centerX = (index / maxIndex) * 100;
    const y = chartBottom - point * (chartHeight - 8);
    const height = Math.max(1.4, chartBottom - y);

    return {
      x: Math.max(0.7, centerX - volumeBarWidth / 2),
      y,
      width: volumeBarWidth,
      height,
      centerX,
      value: volumeValues[index],
    };
  });

  const revenuePath = toSmoothPath(revenuePoints);

  const revenueStartX = revenuePoints[0]?.x ?? 0;
  const revenueEndX = revenuePoints[revenuePoints.length - 1]?.x ?? 100;
  const areaPath = revenuePath
    ? `${revenuePath} L${revenueEndX.toFixed(2)} 95 L${revenueStartX.toFixed(2)} 95 Z`
    : '';

  let revenueLength = 0;
  for (let index = 1; index < revenuePoints.length; index += 1) {
    const dx = revenuePoints[index].x - revenuePoints[index - 1].x;
    const dy = revenuePoints[index].y - revenuePoints[index - 1].y;
    revenueLength += Math.sqrt(dx * dx + dy * dy);
  }

  const activeIndex = hoveredIndex ?? pointCount - 1;
  const tooltipLabel = labels[activeIndex] || `Point ${activeIndex + 1}`;
  const axisIndexes = Array.from(new Set([0, Math.floor((pointCount - 1) / 2), pointCount - 1]));
  const activeRevenuePoint = revenuePoints[activeIndex] ?? revenuePoints[revenuePoints.length - 1];
  const activeVolumeBar = volumeBars[activeIndex] ?? volumeBars[volumeBars.length - 1];
  const guideX = activeRevenuePoint?.x ?? activeVolumeBar?.centerX ?? 0;
  const revenuePeak = Math.max(...revenueValues);
  const revenueAverage =
    revenueValues.reduce((sum, value) => sum + value, 0) / Math.max(revenueValues.length, 1);
  const volumeAverage =
    volumeValues.reduce((sum, value) => sum + value, 0) / Math.max(volumeValues.length, 1);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!frameRef.current || pointCount <= 1) {
      return;
    }

    const rect = frameRef.current.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const nextIndex = Math.min(pointCount - 1, Math.max(0, Math.round(ratio * (pointCount - 1))));

    setHoveredIndex(nextIndex);
  };

  const desiredTooltipPercent = pointCount === 1 ? 50 : (activeIndex / (pointCount - 1)) * 100;
  const frameWidth = frameRef.current?.clientWidth ?? 0;
  const tooltipHalfWidth = 92;
  const tooltipPadding = 8;

  let clampedTooltipPercent = desiredTooltipPercent;
  if (frameWidth > 0) {
    const desiredPx = (desiredTooltipPercent / 100) * frameWidth;
    const minPx = tooltipHalfWidth + tooltipPadding;
    const maxPx = frameWidth - tooltipHalfWidth - tooltipPadding;
    const clampedPx = Math.max(minPx, Math.min(maxPx, desiredPx));
    clampedTooltipPercent = (clampedPx / frameWidth) * 100;
  }

  const tooltipStyle: CSSProperties = {
    left: `${clampedTooltipPercent}%`,
  };

  return (
    <div className="admin-trend-chart-shell">
      <div
        className="admin-trend-chart-frame"
        ref={frameRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          id={chartId}
          className="admin-trend-chart"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Revenue and transaction trend chart"
        >
          <defs>
            <linearGradient id="admin-trend-revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.36)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.04)" />
            </linearGradient>
          </defs>

          <g className="admin-trend-grid">
            {[20, 35, 50, 65, 80].map((y) => (
              <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} />
            ))}
            {Array.from({ length: Math.min(pointCount, 8) }, (_, index) => {
              const x = (index / Math.max(Math.min(pointCount, 8) - 1, 1)) * 100;
              return <line key={`v-${x}`} x1={x} y1="8" x2={x} y2="95" />;
            })}
          </g>

          <line className="admin-trend-guide-line" x1={guideX} y1="8" x2={guideX} y2="95" />

          {areaPath ? <path className="admin-trend-area" d={areaPath} fill="url(#admin-trend-revenue-fill)" /> : null}

          {volumeBars.map((bar, index) => (
            <rect
              key={`bar-${index}`}
              className={`admin-trend-bar ${activeIndex === index ? 'active' : ''}`}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx="1.2"
              ry="1.2"
            />
          ))}

          {revenuePath ? (
            <path
              className="admin-trend-path admin-trend-path-revenue"
              d={revenuePath}
              style={{
                strokeDasharray: revenueLength || undefined,
                strokeDashoffset: revenueLength || undefined,
              }}
            />
          ) : null}

          {revenuePoints.map((point, index) => (
            <circle
              key={`revenue-${index}`}
              className={`admin-trend-point admin-trend-point-revenue ${activeIndex === index ? 'active' : ''}`}
              cx={point.x}
              cy={point.y}
              r={activeIndex === index ? 2.1 : 1.5}
            />
          ))}
        </svg>

        <div className={`admin-trend-tooltip ${hoveredIndex !== null ? 'visible' : ''}`} style={tooltipStyle}>
          <div className="admin-trend-tooltip-label">{tooltipLabel}</div>
          <div className="admin-trend-tooltip-row">Revenue: {formatCurrency(revenueValues[activeIndex] || 0)}</div>
          <div className="admin-trend-tooltip-row">Transactions: {Math.round(volumeValues[activeIndex] || 0)}</div>
        </div>
      </div>

      <div className="admin-trend-axis" aria-hidden="true">
        {axisIndexes.map((index) => (
          <span key={`axis-${index}`} className="admin-trend-axis-label">
            {labels[index] || `Point ${index + 1}`}
          </span>
        ))}
      </div>

      <div className="admin-trend-insights" aria-hidden="true">
        <span>Peak Revenue: {formatCurrency(revenuePeak)}</span>
        <span>Avg Revenue: {formatCurrency(revenueAverage)}</span>
        <span>Avg Txn: {Math.round(volumeAverage).toLocaleString()}</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [attention, setAttention] = useState<AttentionState>({
    pendingApprovals: 0,
    expiringSoon: 0,
    failedToday: 0,
  });
  const [userTrend, setUserTrend] = useState<number[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<number[]>([]);
  const [revenueCountTrend, setRevenueCountTrend] = useState<number[]>([]);
  const [aiTrend, setAiTrend] = useState<number[]>([]);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [aiUsageStats, setAiUsageStats] = useState<any>(null);
  const [trendRange, setTrendRange] = useState<TimeRangeOption>(7);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [error, setError] = useState('');
  const [attentionExpanded, setAttentionExpanded] = useState(true);
  const [pulseSeed, setPulseSeed] = useState(0);
  const [transactionSort, setTransactionSort] = useState<TransactionSortState>({
    key: 'created',
    direction: 'desc',
  });

  async function loadDashboard(range: TimeRangeOption = trendRange, forceRefresh: boolean = false) {
    setError('');

    if (!data) {
      setLoading(true);
    } else if (forceRefresh || range !== trendRange) {
      setIsRefreshing(true);
    }

    try {
      const [
        overview,
        userGrowth,
        revenueMetrics,
        aiMetrics,
        pendingTransactions,
        activeSubscriptions,
        aiUsageStatsResult,
        recentTransactionsResult,
      ] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getUserGrowth(range),
        adminApi.getRevenueMetrics(range),
        adminApi.getAIMetrics(range),
        adminApi.getTransactions({
          page: 1,
          limit: 100,
          status: 'pending',
          type: 'subscription',
        }),
        adminApi.getSubscriptions({
          page: 1,
          limit: 200,
          plan: 'pro',
          status: 'active',
        }),
        adminApi.getAIUsageStats(),
        adminApi.getTransactions({
          page: 1,
          limit: 8,
        }),
      ]);

      const normalizedAi = normalizeAiSnapshot(aiUsageStatsResult, overview.ai.requests_today, 0);

      setData(overview);
      setUserTrend(normalizeTrend(userGrowth.data.map((entry) => Number(entry.count) || 0)));
      setRevenueTrend(normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.amount) || 0)));
      setRevenueCountTrend(
        normalizeTrend(revenueMetrics.data.map((entry) => Number(entry.count) || 0))
      );
      setAiTrend(normalizeTrend(aiMetrics.data.map((entry) => Number(entry.total_requests) || 0)));
      setTrendLabels(revenueMetrics.data.map((entry) => formatTrendDateLabel(entry.date)));
      setRecentTransactions(recentTransactionsResult.data || []);
      setAiUsageStats(aiUsageStatsResult);

      const now = new Date();
      const expiringSoon = activeSubscriptions.data.filter((subscription) => {
        if (!subscription.expires_at) {
          return false;
        }

        const daysUntilExpiry =
          (new Date(subscription.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
      }).length;

      const pendingManualApprovals = pendingTransactions.data.filter(
        (transaction) =>
          transaction.status === 'pending' &&
          transaction.type === 'subscription' &&
          transaction.payment_method === 'manual_qr'
      ).length;

      setAttention({
        pendingApprovals: pendingManualApprovals,
        expiringSoon,
        failedToday: normalizedAi.failed,
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard(trendRange);
  }, [trendRange]);

  const actionQueue =
    attention.pendingApprovals + attention.expiringSoon + Math.max(0, attention.failedToday);
  const isAllClear = actionQueue === 0;

  useEffect(() => {
    setAttentionExpanded(!isAllClear);
  }, [isAllClear]);

  useEffect(() => {
    setPulseSeed((prev) => prev + 1);
  }, [attention.pendingApprovals, attention.expiringSoon, attention.failedToday]);

  const sortedRecentTransactions = useMemo(() => {
    const items = [...recentTransactions];

    items.sort((a, b) => {
      switch (transactionSort.key) {
        case 'user':
          return compareText(
            a.user_name || a.user_email || `User ${a.user_id || ''}`,
            b.user_name || b.user_email || `User ${b.user_id || ''}`,
            transactionSort.direction
          );
        case 'amount':
          return compareNumber(
            Number(a.amount) || 0,
            Number(b.amount) || 0,
            transactionSort.direction
          );
        case 'method':
          return compareText(
            paymentMethodLabel(a.payment_method),
            paymentMethodLabel(b.payment_method),
            transactionSort.direction
          );
        case 'status':
          return compareText(a.status || '', b.status || '', transactionSort.direction);
        case 'created':
        default:
          return compareNumber(
            new Date(a.created_at).getTime() || 0,
            new Date(b.created_at).getTime() || 0,
            transactionSort.direction
          );
      }
    });

    return items;
  }, [recentTransactions, transactionSort]);

  const handleSort = (key: TransactionSortKey) => {
    setTransactionSort((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'created' ? 'desc' : 'asc',
      };
    });
  };

  const getSortIndicator = (key: TransactionSortKey) => {
    if (transactionSort.key !== key) {
      return '↕';
    }

    return transactionSort.direction === 'asc' ? '↑' : '↓';
  };

  const handleExportTrendCsv = () => {
    const maxLength = Math.max(revenueTrend.length, revenueCountTrend.length);

    if (maxLength === 0) {
      return;
    }

    const rows: string[][] = [['Date', 'Revenue', 'Transaction Count']];

    for (let index = 0; index < maxLength; index += 1) {
      rows.push([
        trendLabels[index] || `Point ${index + 1}`,
        String(Math.round(revenueTrend[index] || 0)),
        String(Math.round(revenueCountTrend[index] || 0)),
      ]);
    }

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `seller-inbox-trend-${trendRange}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTrendPng = async () => {
    const chartSvg = document.getElementById('admin-revenue-trend-chart') as SVGSVGElement | null;

    if (!chartSvg) {
      setError('Chart not ready for export yet.');
      return;
    }

    setExportingPng(true);
    setError('');

    try {
      const serializer = new XMLSerializer();
      const serialized = serializer.serializeToString(chartSvg);
      const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to render chart image'));
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 680;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is not available in this browser.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png');
      });

      if (!pngBlob) {
        throw new Error('Could not generate PNG file.');
      }

      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `seller-inbox-trend-${trendRange}d.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pngUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to export chart as PNG.');
    } finally {
      setExportingPng(false);
    }
  };

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="admin-command-header">
          <div className="admin-skeleton admin-skeleton-title" />
          <div className="admin-skeleton admin-skeleton-action-row" />
        </div>
        <div className="admin-kpi-grid admin-kpi-grid-command">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-metric-card">
              <div className="admin-skeleton admin-skeleton-metric-label" />
              <div className="admin-skeleton admin-skeleton-metric-value" />
              <div className="admin-skeleton admin-skeleton-metric-trend" />
            </div>
          ))}
        </div>

        <div className="admin-command-grid">
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
          <div className="admin-command-side-stack">
            <div className="admin-attention-panel">
              <div className="admin-skeleton admin-skeleton-title" />
              <div className="admin-attention-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="admin-skeleton admin-skeleton-attention" />
                ))}
              </div>
            </div>
            <div className="admin-quick-actions">
              <div className="admin-skeleton admin-skeleton-title" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="admin-skeleton admin-skeleton-action-row" />
              ))}
            </div>
          </div>
        </div>

        <div className="admin-command-bottom-grid">
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
          <div className="admin-attention-panel">
            <div className="admin-skeleton admin-skeleton-card-lg" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !data) {
    return (
      <AdminLayout>
        <div className="admin-empty-state">
          <h3 className="admin-empty-state-title">Error loading dashboard</h3>
          <p className="admin-empty-state-description">{error}</p>
          <button className="admin-btn admin-btn-primary" onClick={() => loadDashboard(trendRange, true)}>
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  if (!data) {
    return null;
  }

  const proUsers = data.subscriptions.pro_monthly + data.subscriptions.pro_yearly;

  const aiSnapshot = normalizeAiSnapshot(aiUsageStats, data.ai.requests_today, attention.failedToday);
  const aiSuccessRate = aiSnapshot.rate;
  const aiSuccessRateLabel = formatPercent(aiSuccessRate);

  const aiLast30Days = Number(aiUsageStats?.last_30_days?.total_requests) || data.ai.requests_this_month;
  const aiLast7Days = Number(aiUsageStats?.last_7_days?.total_requests) || 0;
  const aiLatency = Number(aiUsageStats?.today?.avg_latency_ms) || data.ai.avg_latency_ms;

  const aiTrendStatus: TrendTone =
    aiSuccessRate >= 95 ? 'positive' : aiSuccessRate >= 85 ? 'neutral' : 'negative';

  const aiHealthBarStyle: CSSProperties = {
    width: `${Math.max(0, Math.min(100, aiSuccessRate))}%`,
  };

  const lastUpdatedLabel = lastUpdated
    ? `${lastUpdated.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} • ${lastUpdated.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '--';

  const revenueDelta = calculateDelta(revenueTrend);
  const mrrDelta = calculateDelta(revenueCountTrend);
  const usersDelta = calculateDelta(userTrend);
  const aiDelta = calculateDelta(aiTrend);

  const revenueTrendTone = getTrendTone(revenueDelta);
  const mrrTrendTone = getTrendTone(mrrDelta);
  const usersTrendTone = getTrendTone(usersDelta);
  const aiRequestTrendTone = getTrendTone(aiDelta);

  return (
    <AdminLayout>
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
              onClick={() => loadDashboard(trendRange, true)}
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

      {error ? (
        <div className="admin-inline-error">
          <span>{error}</span>
        </div>
      ) : null}

      <section className="admin-section admin-kpi-surface">
        <div className="admin-kpi-grid admin-kpi-grid-command">
          <MetricCard
            label="Today's Revenue"
            icon="💰"
            valueNumber={data.transactions.today.amount}
            formatValue={(value) => formatCurrency(value)}
            comparison={formatDeltaCopy(revenueDelta)}
            hint={`${data.transactions.today.count} payment${data.transactions.today.count === 1 ? '' : 's'} processed`}
            trend={revenueTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/transactions')}
            delayMs={0}
          >
            <Sparkline points={revenueTrend} delayMs={0} />
          </MetricCard>

          <MetricCard
            label="MRR"
            icon="📊"
            valueNumber={data.subscriptions.mrr}
            formatValue={(value) => formatCurrency(value)}
            comparison={formatDeltaCopy(mrrDelta)}
            hint={`${formatNumber(proUsers)} active Pro subscriptions`}
            trend={mrrTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/subscriptions')}
            delayMs={80}
          >
            <Sparkline points={revenueCountTrend} colorClass="admin-sparkline-volume" delayMs={80} />
          </MetricCard>

          <MetricCard
            label="Active Users"
            icon="👥"
            valueNumber={data.users.active}
            formatValue={(value) => Math.round(value).toLocaleString()}
            comparison={formatDeltaCopy(usersDelta)}
            hint={`${formatNumber(data.users.new_this_week)} new this week`}
            trend={usersTrendTone}
            footer="View details →"
            onClick={() => navigate('/admin/users')}
            delayMs={160}
          >
            <Sparkline points={userTrend} delayMs={160} />
          </MetricCard>

          <MetricCard
            label="AI Request Success Rate"
            icon="🤖"
            valueNumber={aiSuccessRate}
            formatValue={(value) => formatPercent(Math.max(0, Math.min(100, value)))}
            comparison={
              aiSnapshot.total > 0
                ? `${aiSuccessRateLabel} • ${aiSnapshot.success}/${aiSnapshot.total} requests succeeded today`
                : 'No AI requests processed today'
            }
            hint={`${aiSnapshot.failed} failures today`}
            trend={aiTrendStatus}
            className={`admin-metric-card-ai admin-metric-card-ai-${aiTrendStatus}`}
            footer="View details →"
            onClick={() => navigate('/admin/ai-usage')}
            delayMs={240}
          >
            <Sparkline points={aiTrend} delayMs={240} />
          </MetricCard>
        </div>
      </section>

      <div className="admin-command-grid">
        <section className="admin-command-chart-card">
          <SectionHeader
            title="Revenue and Payment Trend"
            subtitle="Normalized movement for revenue and payment volume"
            actions={(
              <div className="admin-chart-actions">
                <div className="admin-range-toggle" role="tablist" aria-label="Trend range selector">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-range-toggle-btn ${trendRange === option.value ? 'active' : ''}`}
                      onClick={() => setTrendRange(option.value)}
                      role="tab"
                      aria-selected={trendRange === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="admin-chart-export-actions">
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleExportTrendCsv}>
                    Download CSV
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary admin-btn-sm"
                    onClick={handleExportTrendPng}
                    disabled={exportingPng}
                  >
                    {exportingPng ? 'Exporting...' : 'Download PNG'}
                  </button>
                </div>
              </div>
            )}
          />

          <TrendPanelChart
            chartId="admin-revenue-trend-chart"
            revenue={revenueTrend}
            volume={revenueCountTrend}
            labels={trendLabels}
          />

          <div className="admin-command-chart-legend">
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch revenue" /> Revenue
            </span>
            <span className="admin-command-legend-item">
              <span className="admin-command-legend-swatch volume" /> Transaction count
            </span>
          </div>
        </section>

        <div className="admin-command-side-stack">
          <section className="admin-attention-panel">
            <SectionHeader
              title="Action Required"
              subtitle="Items requiring immediate attention"
              actions={(
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => setAttentionExpanded((previous) => !previous)}
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
                  value: data.users.total,
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
      </div>

      <div className="admin-command-bottom-grid">
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

          {sortedRecentTransactions.length > 0 ? (
            <div className="admin-command-table-wrapper">
              <table className="admin-command-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="admin-command-table-sort-btn" onClick={() => handleSort('user')}>
                        User {getSortIndicator('user')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-command-table-sort-btn" onClick={() => handleSort('amount')}>
                        Amount {getSortIndicator('amount')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-command-table-sort-btn" onClick={() => handleSort('method')}>
                        Method {getSortIndicator('method')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-command-table-sort-btn" onClick={() => handleSort('status')}>
                        Status {getSortIndicator('status')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="admin-command-table-sort-btn" onClick={() => handleSort('created')}>
                        Created {getSortIndicator('created')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecentTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="admin-command-table-row-clickable"
                      onClick={() => navigate(`/admin/transactions?focus=${transaction.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/admin/transactions?focus=${transaction.id}`);
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
                {aiSnapshot.total > 0
                  ? `${aiSuccessRateLabel} • ${aiSnapshot.success}/${aiSnapshot.total} requests succeeded today`
                  : 'No AI requests processed today yet'}
              </div>
            </div>
          </div>

          <div className="admin-health-grid">
            <div className="admin-health-cell">
              <span>Failed Requests</span>
              <strong>{aiSnapshot.failed}</strong>
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
              <strong>{formatDeltaCopy(aiDelta, 'vs previous day')}</strong>
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
      </div>
    </AdminLayout>
  );
}

export default Dashboard;
