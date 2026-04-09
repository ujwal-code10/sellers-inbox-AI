import { CSSProperties, MouseEvent, useRef, useState } from 'react';

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

function formatCurrency(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString()}`;
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

export default function TrendPanelChart({
  chartId,
  revenue,
  volume,
  labels,
}: TrendPanelChartProps) {
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

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
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
