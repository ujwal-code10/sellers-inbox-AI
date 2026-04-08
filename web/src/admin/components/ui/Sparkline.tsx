interface SparklineProps {
  points: number[];
  colorClass?: string;
  delayMs?: number;
  animate?: boolean;
}

function normalizePoints(points: number[]) {
  if (points.length === 0) return [];
  const min = Math.min(...points);
  const max = Math.max(...points);
  if (min === max) {
    return points.map((_, idx) => ({ x: idx, y: 0.5 }));
  }

  return points.map((value, idx) => ({
    x: idx,
    y: (value - min) / (max - min),
  }));
}

export function Sparkline({ points, colorClass = '', delayMs = 0, animate = true }: SparklineProps) {
  if (!points.length) {
    return <div className="admin-sparkline-empty" />;
  }

  const normalized = normalizePoints(points);
  const width = 100;
  const height = 32;
  const maxX = Math.max(normalized.length - 1, 1);

  const chartPoints = normalized.map((point) => {
    const x = (point.x / maxX) * width;
    const y = height - point.y * (height - 4) - 2;
    return { x, y };
  });

  let lengthEstimate = 0;
  for (let i = 1; i < chartPoints.length; i += 1) {
    const dx = chartPoints[i].x - chartPoints[i - 1].x;
    const dy = chartPoints[i].y - chartPoints[i - 1].y;
    lengthEstimate += Math.sqrt(dx * dx + dy * dy);
  }

  const path = chartPoints
    .map((point, idx) => {
      return `${idx === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      className={`admin-sparkline ${colorClass}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="admin-sparkline-path"
        style={{
          strokeDasharray: animate ? lengthEstimate || undefined : undefined,
          strokeDashoffset: animate ? lengthEstimate || undefined : undefined,
          animationDelay: `${delayMs}ms`,
        }}
      />
      {chartPoints.map((point, index) => (
        <circle
          key={`${point.x}-${point.y}`}
          className="admin-sparkline-dot"
          cx={point.x}
          cy={point.y}
          r={1.7}
          style={{ animationDelay: `${delayMs + index * 50}ms` }}
        />
      ))}
    </svg>
  );
}

export default Sparkline;
