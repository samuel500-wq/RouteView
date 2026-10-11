'use client';

export default function BarChart({
  data,
  height = 220,
  accent = '#0ea5e9',
  vertical = false
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  accent?: string;
  vertical?: boolean;
}) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400 dark:bg-slate-900/50"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  if (vertical) {
    // Horizontal bars — good for route lists
    return (
      <ul className="space-y-3">
        {data.map((d, i) => (
          <li key={i} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">{d.label}</span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                {d.value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  backgroundColor: d.color || accent
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  // Vertical bars — good for hour-of-day
  const barCount = data.length;
  const barGap = 2;
  const width = Math.max(200, barCount * (14 + barGap));
  const padding = { top: 8, right: 4, bottom: 22, left: 4 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const barW = (innerW - barGap * (barCount - 1)) / barCount;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ display: 'block' }}>
      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = padding.left + i * (barW + barGap);
        const y = padding.top + innerH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(2, h)}
              rx="2"
              fill={d.color || accent}
              opacity={d.value === 0 ? 0.15 : 0.9}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {i % 3 === 0 && (
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-current text-[9px] opacity-50"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}