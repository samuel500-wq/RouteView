'use client';

export default function KpiCard({
  label, value, unit, change, tone = 'sky', hint, icon
}: {
  label: string;
  value: string | number;
  unit?: string;
  change?: number;
  tone?: 'sky' | 'emerald' | 'violet' | 'amber' | 'slate';
  hint?: string;
  icon?: React.ReactNode;
}) {
  const accents = {
    sky:     { bg: 'bg-sky-50 dark:bg-sky-950/40',       fg: 'text-sky-600 dark:text-sky-400',       ring: 'ring-sky-100 dark:ring-sky-900/40' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-100 dark:ring-emerald-900/40' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-950/40',   fg: 'text-violet-600 dark:text-violet-400',   ring: 'ring-violet-100 dark:ring-violet-900/40' },
    amber:   { bg: 'bg-amber-50 dark:bg-amber-950/40',     fg: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-100 dark:ring-amber-900/40' },
    slate:   { bg: 'bg-slate-100 dark:bg-slate-800',       fg: 'text-slate-600 dark:text-slate-300',     ring: 'ring-slate-100 dark:ring-slate-900/40' }
  }[tone];

  const changePositive = (change ?? 0) > 0;
  const changeNegative = (change ?? 0) < 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${accents.bg} ${accents.fg} ${accents.ring}`}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1">
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </div>

      {change !== undefined && change !== 0 && (
        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
          changePositive ? 'text-emerald-600 dark:text-emerald-400'
          : changeNegative ? 'text-red-600 dark:text-red-400'
          : 'text-slate-400'
        }`}>
          <span>{changePositive ? '▲' : changeNegative ? '▼' : '—'}</span>
          {Math.abs(change)}%
          <span className="font-normal text-slate-400">vs prior 30d</span>
        </p>
      )}

      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}