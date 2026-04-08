interface SparklineProps {
  points: number[];
  colorClass?: string;
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

export function Sparkline({ points, colorClass = '' }: SparklineProps) {
  if (!points.length) {
    return <div className="admin-sparkline-empty" />;
  }

  const normalized = normalizePoints(points);
  const width = 100;
  const height = 32;
  const maxX = Math.max(normalized.length - 1, 1);

  const path = normalized
    .map((point, idx) => {
      const x = (point.x / maxX) * width;
      const y = height - point.y * (height - 4) - 2;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg className={`admin-sparkline ${colorClass}`.trim()} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default Sparkline;
