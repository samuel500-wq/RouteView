'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import KpiCard from '@/components/admin/KpiCard';
import LineChart from '@/components/admin/LineChart';
import BarChart from '@/components/admin/BarChart';
import DonutChart from '@/components/admin/DonutChart';
import AiInsights from '@/components/admin/AiInsights';

export default function AdminDashboard() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api.adminDashboard().then(setData).catch((e) => setErr(e.message));
  }, [tick]);

  // Auto-refresh every 20 seconds
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, []);

  if (err) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {err}
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { overview, trend, top_routes, bookings_by_hour, bookings_by_province, recent_activity, fleet } = data;

  // Prepare chart data
  const lineData = trend.map((d: any) => ({
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: d.total,
    secondaryValue: d.revenue / 1000
  }));

  const hourBars = bookings_by_hour.map((h: any) => ({
    label: `${String(h.hour).padStart(2, '0')}`,
    value: h.count,
    color: h.count === 0 ? '#cbd5e1'
      : h.count >= 20 ? '#0ea5e9'
      : h.count >= 10 ? '#38bdf8'
      : '#7dd3fc'
  }));

  const routeBars = top_routes.map((r: any) => ({
    label: `${r.label} · ${r.sub}`,
    value: r.bookings,
    color: r.color
  }));

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Ibibaho', 'Dashboard')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Incamake y’ingendo, ibiciro n’imiterere y’ibisi mu minsi 30 ishize.',
              'Operations, revenue and fleet health over the last 30 days.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {t('Bivugururwa', 'Live')}
          </span>
          <button
            onClick={() => setTick((n) => n + 1)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200"
          >
            {t('Vugurura', 'Refresh')}
          </button>
        </div>
      </header>

      {/* ---------- KPIs ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('Amafaranga (30d)', 'Revenue (30d)')}
          value={overview.revenue_30d}
          unit="RWF"
          change={overview.revenue_change_pct}
          tone="emerald"
          icon={<Money />}
        />
        <KpiCard
          label={t('Ingendo zishyuwe', 'Bookings (30d)')}
          value={overview.bookings_30d}
          change={overview.bookings_change_pct}
          tone="sky"
          hint={t('Urban + interprovincial', 'Urban + interprovincial')}
          icon={<TicketIcon />}
        />
        <KpiCard
          label={t('Bisi ziri gukora', 'Active vehicles')}
          value={overview.active_vehicles}
          unit={`/ ${overview.total_vehicles}`}
          tone="violet"
          hint={overview.simulated_vehicles > 0
            ? `${overview.simulated_vehicles} ${t('by’ikigereranyo', 'simulated')}`
            : t('Byose ni GPS', 'All live')}
          icon={<BusIcon />}
        />
        <KpiCard
          label={t('Bileti zagenzuwe', 'Redemptions (30d)')}
          value={overview.redemptions_30d}
          tone="amber"
          hint={`${overview.active_alerts} ${t('itangazo rikora', overview.active_alerts === 1 ? 'active alert' : 'active alerts')}`}
          icon={<QrIcon />}
        />
      </div>

      {/* ---------- Main grid ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Line chart */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('Ingendo ku munsi', 'Daily bookings')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {t('Iminsi 30 ishize', 'Last 30 days')} ·{' '}
                <span className="font-medium text-sky-600 dark:text-sky-400">{t('Ingendo', 'Bookings')}</span>
                {' · '}
                <span className="font-medium text-violet-600 dark:text-violet-400">
                  {t('Amafaranga (×1000)', 'Revenue (×1000)')}
                </span>
              </p>
            </div>
            <div className="flex items-baseline gap-3 text-[11px]">
              <div>
                <p className="text-slate-400">{t('Impuzandengo', 'Daily avg')}</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {Math.round(trend.reduce((s: number, d: any) => s + d.total, 0) / Math.max(1, trend.length))}
                </p>
              </div>
              <div>
                <p className="text-slate-400">{t('Igipimo', 'Peak')}</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {Math.max(...trend.map((d: any) => d.total), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="text-slate-300 dark:text-slate-700">
            <LineChart data={lineData} accent="#0ea5e9" secondary="#8b5cf6" height={240} />
          </div>
        </section>

        {/* AI insights */}
        <AiInsights />
      </div>

      {/* ---------- Second row: bar + hour ---------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('Ingendo nyinshi', 'Top routes')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {t('Mu minsi 30 ishize', 'Last 30 days')}
              </p>
            </div>
            <Link href="/admin/routes" className="text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400">
              {t('Reba zose', 'View all')} →
            </Link>
          </div>
          {routeBars.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {t('Nta ngendo zirahari.', 'No bookings yet.')}
            </p>
          ) : (
            <BarChart data={routeBars} vertical accent="#0ea5e9" />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Igihe abantu bakunda kugenda', 'Departures by hour')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('Amasaha 24 · iminsi 30', '24 hours · last 30 days')}
            </p>
          </div>
          <div className="text-slate-300 dark:text-slate-700">
            <BarChart data={hourBars} accent="#0ea5e9" height={200} />
          </div>
        </section>
      </div>

      {/* ---------- Third row: donut + activity ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ingendo ku ntara', 'By province')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('Interprovincial + urban', 'Interprovincial + urban')}
            </p>
          </div>
          <DonutChart data={bookings_by_province} size={180} thickness={20} />
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ibikorwa bya vuba', 'Recent activity')}
            </h2>
            <Link href="/admin/bookings" className="text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400">
              {t('Reba byose', 'View all')} →
            </Link>
          </header>
          {recent_activity.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              {t('Nta gikorwa kirahari.', 'Nothing yet.')}
            </p>
          ) : (
            <ul className="max-h-[340px] divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
              {recent_activity.map((a: any, i: number) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    a.kind === 'booking'
                      ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  }`}>
                    {a.kind === 'booking' ? <TicketIcon /> : <QrIcon />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {a.label}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{a.detail}</p>
                  </div>
                  {a.amount != null && (
                    <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{a.amount.toLocaleString()} RWF
                    </span>
                  )}
                  <span className="flex-shrink-0 text-[10px] text-slate-400">
                    {timeAgo(a.ts)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Fleet strip ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Imiterere y’ibisi', 'Fleet status')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {tripSummary(fleet, t)}
            </p>
          </div>
          <Link href="/map" className="text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400">
            {t('Reba ku ikarita', 'Open live map')} →
          </Link>
        </div>

        {Object.keys(fleet.by_route).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {t('Nta bisi zirahari ubu.', 'No active vehicles right now.')}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(fleet.by_route).map(([code, vehs]: any) => (
              <div key={code} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{code}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                    {vehs.length} {vehs.length === 1 ? t('bisi', 'bus') : t('bisi', 'buses')}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {vehs.slice(0, 3).map((v: any, i: number) => (
                    <li key={i} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-slate-600 dark:text-slate-400">{v.plate}</span>
                      <span className="ml-2 flex-shrink-0 font-mono text-slate-500">
                        {v.passengers}/{v.capacity}
                        {v.simulated && <span className="ml-1 text-amber-500">·sim</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================== */

function tripSummary(fleet: any, t: (rw: string, en: string) => string) {
  return `${fleet.total} ${t('bisi zirakora', fleet.total === 1 ? 'bus active' : 'buses active')} · ${t('simulator', 'simulator')} ${fleet.simulator.running ? t('irakora', 'running') : t('ifunze', 'stopped')}`;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function Money() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 6v2M13 10v2M13 14v2M13 18v0" />
    </svg>
  );
}
function BusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Z" />
      <path d="M4 12h16M8 20v-2M16 20v-2" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v3M14 20h6" />
    </svg>
  );
}