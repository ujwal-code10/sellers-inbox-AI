import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value?: string | number;
  valueNumber?: number;
  formatValue?: (value: number) => string;
  hint?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  className?: string;
  icon?: string;
  comparison?: string;
  footer?: string;
  delayMs?: number;
  onClick?: () => void;
  children?: ReactNode;
}

export function MetricCard({
  label,
  value,
  valueNumber,
  formatValue,
  hint,
  trend = 'neutral',
  className = '',
  icon,
  comparison,
  footer,
  delayMs = 0,
  onClick,
  children,
}: MetricCardProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [ripplePosition, setRipplePosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof valueNumber !== 'number' || Number.isNaN(valueNumber)) {
      return;
    }

    const target = valueNumber;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setAnimatedValue(target);
      return;
    }

    let raf = 0;
    let timer = 0;
    const duration = 900;

    const startAnimation = () => {
      const startedAt = performance.now();
      const step = (timestamp: number) => {
        const progress = Math.min((timestamp - startedAt) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        setAnimatedValue(target * easedProgress);

        if (progress < 1) {
          raf = window.requestAnimationFrame(step);
        }
      };

      setAnimatedValue(0);
      raf = window.requestAnimationFrame(step);
    };

    if (delayMs > 0) {
      timer = window.setTimeout(startAnimation, delayMs);
    } else {
      startAnimation();
    }

    return () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [valueNumber, delayMs]);

  const displayedValue = useMemo(() => {
    if (typeof valueNumber !== 'number' || Number.isNaN(valueNumber)) {
      return value;
    }

    if (formatValue) {
      return formatValue(animatedValue);
    }

    return Math.round(animatedValue).toLocaleString();
  }, [animatedValue, formatValue, value, valueNumber]);

  const isClickable = typeof onClick === 'function';

  const handleCardClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setRipplePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    setRippleKey((prev) => prev + 1);
    onClick();
  };

  const cardClassName = `admin-metric-card admin-metric-card-reveal admin-metric-card-${trend} ${
    isClickable ? 'admin-metric-card-clickable' : ''
  } ${className}`.trim();

  const cardStyle = {
    animationDelay: `${delayMs}ms`,
  };

  const content = (
    <>
      <div className="admin-metric-label-row">
        {icon ? <span className="admin-metric-icon" aria-hidden="true">{icon}</span> : null}
        <div className="admin-metric-label">{label}</div>
      </div>
      <div className="admin-metric-value">{displayedValue}</div>
      {comparison ? <div className="admin-metric-comparison">{comparison}</div> : null}
      {hint ? <div className={`admin-metric-hint ${trend}`}>{hint}</div> : null}
      {children}
      {footer ? <div className="admin-metric-footer">{footer}</div> : null}
      {isClickable && ripplePosition ? (
        <span
          key={rippleKey}
          className="admin-metric-ripple"
          style={{
            left: ripplePosition.x,
            top: ripplePosition.y,
          }}
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        className={cardClassName}
        style={cardStyle}
        onClick={handleCardClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cardClassName} style={cardStyle}>
      {content}
    </div>
  );
}

export default MetricCard;
