'use client';

export default function DonutChart({
  data,
  size = 200,
  thickness = 22
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-slate-400">
        No data for this period
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;

  let cumulative = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumulative + fraction) * 2 * Math.PI - Math.PI / 2;
    cumulative += fraction;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

    return { path, color: d.color, label: d.label, value: d.value, fraction };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block -rotate-0">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth={thickness}
          />
          {segments.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
            >
              <title>{`${s.label}: ${s.value} (${Math.round(s.fraction * 100)}%)`}</title>
            </path>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{total.toLocaleString()}</p>
        </div>
      </div>

      <ul className="flex-1 space-y-2 text-xs">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-slate-700 dark:text-slate-300">{s.label}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
              {s.value}
            </span>
            <span className="w-10 text-right tabular-nums text-slate-400">
              {Math.round(s.fraction * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}