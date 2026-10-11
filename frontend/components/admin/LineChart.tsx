'use client';

export default function LineChart({
  data,
  height = 240,
  accent = '#0ea5e9',
  secondary,
  showAxis = true
}: {
  data: { label: string; value: number; secondaryValue?: number }[];
  height?: number;
  accent?: string;
  secondary?: string;
  showAxis?: boolean;
}) {
  if (!data.length) {
    return <Empty height={height} />;
  }

  const padding = { top: 16, right: 8, bottom: showAxis ? 28 : 8, left: 8 };
  const width = 800;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((d) => Math.max(d.value, d.secondaryValue ?? 0)), 1);
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;

  const pt = (i: number, v: number): [number, number] => [
    padding.left + i * step,
    padding.top + innerH - (v / max) * innerH
  ];

  // Build a smooth path using Catmull-Rom → Bézier
  function smoothPath(values: number[]): string {
    if (values.length < 2) return '';
    const points = values.map((v, i) => pt(i, v));
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  const values = data.map((d) => d.value);
  const secondaryValues = data.map((d) => d.secondaryValue ?? 0);

  const linePath = smoothPath(values);
  const areaPath = `${linePath} L ${padding.left + (data.length - 1) * step},${padding.top + innerH} L ${padding.left},${padding.top + innerH} Z`;

  // Grid lines (4 horizontal)
  const gridYs = [0.25, 0.5, 0.75, 1].map((f) => padding.top + innerH * f);

  // X-axis labels: show ~6 evenly spaced
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={`grad-${accent.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showAxis && (
        <>
          {gridYs.map((y, i) => (
            <line
              key={i}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeDasharray="4 4"
            />
          ))}
        </>
      )}

      {secondary && (
        <path
          d={smoothPath(secondaryValues)}
          fill="none"
          stroke={secondary}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.7"
        />
      )}

      <path d={areaPath} fill={`url(#grad-${accent.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {values.map((v, i) => (
        <circle
          key={i}
          cx={pt(i, v)[0]}
          cy={pt(i, v)[1]}
          r="2.5"
          fill={accent}
          stroke="white"
          strokeWidth="1"
          className="opacity-0 transition-opacity hover:opacity-100"
        >
          <title>{`${data[i].label}: ${v}`}</title>
        </circle>
      ))}

      {showAxis && data.map((d, i) => (
        i % labelStep === 0 ? (
          <text
            key={i}
            x={pt(i, 0)[0]}
            y={height - 8}
            textAnchor="middle"
            className="fill-current text-[10px] opacity-50"
          >
            {d.label}
          </text>
        ) : null
      ))}
    </svg>
  );
}

function Empty({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400 dark:bg-slate-900/50"
      style={{ height }}
    >
      No data for this period
    </div>
  );
}