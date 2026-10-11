'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false });

export default function RouteDetailPage({ params }: { params: { id: string } }) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    api.routeAnalytics(Number(params.id)).then(setData).catch((e) => setErr(e.message));
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.vehicles();
        if (!cancelled) setVehicles(r.vehicles.filter((v: any) => v.route_id === Number(params.id)));
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [params.id]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-500">{t('Turashakisha…', 'Loading…')}</p>;

  const { route, stops, schedules, fares, bookings, live_vehicles, alerts, insights, distance_km, trend } = data;

  return (
    <div className="space-y-8">
      {/* ---------- Back ---------- */}
      <Link href="/routes" className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:underline dark:text-sky-400">
        <span aria-hidden>←</span> {t('Ingendo zose', 'All routes')}
      </Link>

      {/* ---------- Header ---------- */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: route.color_hex }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex h-12 min-w-[64px] items-center justify-center rounded-2xl px-3 text-lg font-bold text-white shadow-md"
              style={{ backgroundColor: route.color_hex }}
            >
              {route.code}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                {lang === 'rw' ? route.name_rw : route.name_en}
              </h1>
              <p className="text-sm text-slate-500">{route.direction_label}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <HeaderStat label={t('Intera', 'Distance')} value={`${distance_km} km`} />
            <HeaderStat label={t('Ahantu', 'Stops')} value={String(stops.length)} />
            <HeaderStat
              label={t('Igiciro', 'Fare range')}
              value={fares.pairs > 0 ? `${fares.min_rwf}–${fares.max_rwf}` : '—'}
              hint="RWF"
            />
            <HeaderStat
              label={t('Bisi ubu', 'Live now')}
              value={String(live_vehicles.length)}
              tone={live_vehicles.length > 0 ? 'emerald' : 'default'}
            />
          </div>
        </div>
      </header>

      {/* ---------- Insights grid ---------- */}
      {insights.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
            {t('Incamake', 'At a glance')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins: any, i: number) => (
              <li
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <InsightIcon name={ins.icon} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    {ins.label}
                  </p>
                </div>
                <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {ins.value}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{ins.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Recommendations ---------- */}
      {data.insights.recommendations.length > 0 && (
        <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 dark:border-violet-900/60 dark:from-violet-950/30 dark:via-slate-900 dark:to-sky-950/20">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-violet-600 dark:text-violet-400">
              <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
            </svg>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300">
              {t('Ibyifuzo ku nzira', 'Route insights')}
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            {data.insights.recommendations.map((rec: any, i: number) => (
              <li
                key={i}
                className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
              >
                <p className={`text-sm font-semibold ${
                  rec.tone === 'warning' ? 'text-amber-700 dark:text-amber-300'
                  : rec.tone === 'success' ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-900 dark:text-white'
                }`}>
                  {rec.title}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{rec.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Alerts ---------- */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((a: any) => (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${
                a.severity === 'critical'
                  ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
                  : a.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                  : 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40'
              }`}
            >
              <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-current opacity-70" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
                  {a.severity}
                </p>
                <p className="mt-0.5 font-medium">{lang === 'rw' ? a.title_rw : a.title_en}</p>
                <p className="text-sm opacity-80">{lang === 'rw' ? a.body_rw : a.body_en}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ---------- Live map ---------- */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('Ikarita y’inzira', 'Route map')}
          </h2>
          <Link href="/map" className="text-sm text-sky-600 hover:underline dark:text-sky-400">
            {t('Reba ikarita yuzuye', 'Open live map')} →
          </Link>
        </div>
        <RouteMap stops={stops} color={route.color_hex} />
        {live_vehicles.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {live_vehicles.length} {t(
              live_vehicles.length === 1 ? 'vehicle currently on this route' : 'vehicles currently on this route',
              live_vehicles.length === 1 ? 'vehicle currently on this route' : 'vehicles currently on this route'
            )}
            {live_vehicles.some((v: any) => v.simulated) && (
              <span className="ml-1 text-amber-500">· {t('bimwe ni ibigereranyo', 'some are simulated')}</span>
            )}
          </p>
        )}
      </section>

      {/* ---------- Analytics: 2-column ---------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Peak hours */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {t('Igihe abantu bakunda kugenda', 'Popular departure hours')}
          </h3>
          {data.peak_hours.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              {t('Nta makuru arahari ku bijyanye n’ibihe.', 'No booking data yet for this route.')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.peak_hours.map((h: any) => (
                <li key={h.hour} className="flex items-center gap-3">
                  <span className="w-12 text-sm font-mono tabular-nums text-slate-500">
                    {String(h.hour).padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                      style={{ width: `${Math.min(100, (h.count / (data.peak_hours[0]?.count || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{h.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bookings trend */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {t('Ingendo zishyuwe (iminsi 14)', 'Bookings, last 14 days')}
          </h3>
          {trend.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              {t('Nta ndende y’ingendo irahari.', 'No bookings recorded for this route yet.')}
            </p>
          ) : (
            <>
              <div className="mt-4 flex h-32 items-end gap-1">
                {trend.map((d: any, i: number) => {
                  const max = Math.max(...trend.map((x: any) => x.count), 1);
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                      <div
                        className="w-full rounded-t bg-sky-500/80 transition hover:bg-sky-500"
                        style={{ height: `${(d.count / max) * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-slate-400">
                <span>{trend[0]?.date?.slice(5)}</span>
                <span>{trend[trend.length - 1]?.date?.slice(5)}</span>
              </div>
            </>
          )}
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <TrendStat label={t('Zose', 'Total')} value={bookings.total} />
            <TrendStat label={t('Amafaranga', 'Revenue')} value={`${bookings.revenue_rwf.toLocaleString()}`} hint="RWF" />
            <TrendStat label={t('Impuzandengo', 'Avg')} value={`${bookings.avg_paid_rwf}`} hint="RWF" />
          </dl>
        </div>
      </section>

      {/* ---------- Stops + schedule ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {t('Ahantu ho guhagarara', 'Stops in order')}
          </h3>
          <ol className="mt-4 space-y-2">
            {stops.map((s: any, i: number) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800/40"
              >
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: route.color_hex }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900 dark:text-white">
                    {lang === 'rw' ? s.name_rw : s.name_en}
                  </p>
                  <p className="text-[11px] text-slate-500">{s.code}</p>
                </div>
                <span className="flex-shrink-0 font-mono text-[10px] text-slate-400">
                  {(s.distance_from_start_m / 1000).toFixed(1)} km
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {t('Igihe', 'Departures today')}
          </h3>
          {schedules.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t('Nta gihe kiratangazwa.', 'No schedule published.')}</p>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-4 gap-1.5 text-sm">
                {schedules.map((s: any, i: number) => (
                  <li
                    key={i}
                    className="rounded-md bg-slate-100 px-2 py-1 text-center font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {String(s.departure_time).slice(0, 5)}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">
                {schedules.length} {t('ingendo ku munsi', 'departures per day')}
              </p>
            </>
          )}

          {/* CTA */}
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <Link
              href={`/plan`}
              className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {t('Tegura urugendo kuri iyi nzira', 'Plan a journey on this route')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeaderStat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'emerald' }) {
  const color = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white';
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span>}
      </p>
    </div>
  );
}

function TrendStat({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
        {value}
        {hint && <span className="ml-1 text-[10px] font-normal text-slate-400">{hint}</span>}
      </dd>
    </div>
  );
}

function InsightIcon({ name }: { name: string }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const cls = 'text-slate-500 dark:text-slate-400';
  switch (name) {
    case 'distance':
      return <svg {...common} className={cls}><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
    case 'fare':
      return <svg {...common} className={cls}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'live':
      return <svg {...common} className={cls}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>;
    case 'clock':
      return <svg {...common} className={cls}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></svg>;
    case 'frequency':
      return <svg {...common} className={cls}><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>;
    case 'trend':
      return <svg {...common} className={cls}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>;
    default:
      return <svg {...common} className={cls}><circle cx="12" cy="12" r="9" /></svg>;
  }
}