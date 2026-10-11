'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Route = {
  id: number;
  code: string;
  name_rw: string;
  name_en: string;
  direction_label: string;
  color_hex: string;
};

export default function RoutesPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'code' | 'name' | 'live'>('code');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRoutes().then((r) => setRoutes(r.routes)).finally(() => setLoading(false));

    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.vehicles();
        if (!cancelled) setVehicles(r.vehicles);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const liveByRoute = useMemo(() => {
    const m: Record<number, number> = {};
    for (const v of vehicles) {
      if (!v.route_id) continue;
      m[v.route_id] = (m[v.route_id] || 0) + 1;
    }
    return m;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle
      ? routes.filter((r) =>
          `${r.code} ${r.name_en} ${r.name_rw} ${r.direction_label}`.toLowerCase().includes(needle)
        )
      : routes;

    if (sort === 'name') {
      out = [...out].sort((a, b) =>
        (lang === 'rw' ? a.name_rw : a.name_en).localeCompare(
          lang === 'rw' ? b.name_rw : b.name_en
        )
      );
    } else if (sort === 'live') {
      out = [...out].sort((a, b) => (liveByRoute[b.id] || 0) - (liveByRoute[a.id] || 0));
    } else {
      out = [...out].sort((a, b) => a.code.localeCompare(b.code));
    }
    return out;
  }, [routes, q, sort, liveByRoute, lang]);

  const totalLive = vehicles.length;

  return (
    <div className="space-y-8">
      {/* ---------- HERO ---------- */}
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 dark:border-slate-800 dark:from-sky-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
            {t('Urubuga rw’ingendo', 'The network')}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {t('Ingendo zose za RouteView', 'Every route in RouteView')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {t(
              'Hitamo ingendo kugira ngo ubone ibiciro, aho zihagarara, ibihe, n’amakuru y’ubushakashatsi ku nzira.',
              'Pick a route to see fares, stops, schedules, live vehicles, and analytics for that corridor.'
            )}
          </p>

          <dl className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            <Stat label={t('Ingendo', 'Routes')} value={routes.length || '—'} />
            <Stat label={t('Bisi ubu', 'Live now')} value={totalLive || '—'} tone="emerald" />
            <Stat label={t('Kigali', 'Kigali')} value={t('Rwanda', 'Rwanda')} tone="muted" />
          </dl>
        </div>
      </header>

      {/* ---------- CONTROLS ---------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Shakisha ingendo…', 'Search routes, stops, directions…')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <option value="code">{t('Kubara: Kode', 'Sort: Code')}</option>
          <option value="name">{t('Kubara: Izina', 'Sort: Name')}</option>
          <option value="live">{t('Kubara: Ziri gukora', 'Sort: Live vehicles')}</option>
        </select>
      </div>

      {/* ---------- LIST ---------- */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-white">
            {t('Nta ndege ibonetse', 'No routes found')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('Gerageza ukoreshe andi magambo.', 'Try different search terms.')}
          </p>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((r) => {
          const live = liveByRoute[r.id] || 0;
          return (
            <li key={r.id}>
              <Link
                href={`/routes/${r.id}`}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 min-w-[52px] items-center justify-center rounded-xl px-2 text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: r.color_hex }}
                  >
                    {r.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 group-hover:text-sky-600 dark:text-white dark:group-hover:text-sky-400">
                      {lang === 'rw' ? r.name_rw : r.name_en}
                    </p>
                    <p className="text-xs text-slate-500">{r.direction_label}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  {live > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {live} {t('bisi', live === 1 ? 'bus' : 'buses')}
                    </span>
                  ) : (
                    <span className="text-slate-400">{t('Nta bisi ubu', 'No vehicles now')}</span>
                  )}
                  <span className="inline-flex items-center gap-1 font-semibold text-sky-600 group-hover:gap-2 dark:text-sky-400">
                    {t('Reba', 'View')} <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: any; tone?: 'default' | 'emerald' | 'muted' }) {
  const color =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'muted' ? 'text-slate-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="text-center">
      <dd className={`text-2xl font-bold tracking-tight ${color}`}>{value}</dd>
      <dt className="mt-0.5 text-[11px] uppercase tracking-widest text-slate-400">{label}</dt>
    </div>
  );
}