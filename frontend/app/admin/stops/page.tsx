'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/Confirm';
import BarChart from '@/components/admin/BarChart';
import DonutChart from '@/components/admin/DonutChart';

type Stop = {
  id: number;
  code: string;
  name_rw: string;
  name_en: string;
  lat: number;
  lng: number;
  is_active: number | boolean;
};

export default function AdminStopsPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const confirm = useConfirm();

  const [stops, setStops] = useState<Stop[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'code' | 'routes' | 'boardings'>('routes');

  const [editing, setEditing] = useState<Partial<Stop> | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  async function refreshStops() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.adminListStops();
      setStops(r.stops);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    try {
      const r = await api.adminStopsAnalytics();
      setAnalytics(r);
    } catch { /* ignore */ }
    finally { setAnalyticsLoading(false); }
  }

  async function refreshAll() {
    await Promise.all([refreshStops(), refreshAnalytics()]);
  }

  useEffect(() => { refreshAll(); }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Enrich stops with route count + boardings from analytics ---------- */
  const enrichedStops = useMemo(() => {
    if (!analytics) return stops.map((s) => ({ ...s, route_count: 0, departures_30d: 0 }));
    const byId = new Map<number, any>();
    for (const r of analytics.top_by_routes) byId.set(r.id, r);
    // The analytics endpoint doesn't return every stop's counts; build a lookup from
    // the derived arrays plus a fallback of zeros. For exact counts we rely on the
    // route_distribution aggregate and top lists. Stops not in any top list are
    // assumed low-activity for display purposes.
    return stops.map((s) => {
      const found = byId.get(s.id);
      return {
        ...s,
        route_count: found?.route_count ?? 0,
        departures_30d: found?.departures_30d ?? 0
      };
    });
  }, [stops, analytics]);

  /* ---------- Filtering / sorting ---------- */
  const filtered = useMemo(() => {
    let out = enrichedStops;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((s) =>
        `${s.code} ${s.name_en} ${s.name_rw}`.toLowerCase().includes(needle)
      );
    }
    if (status !== 'all') {
      out = out.filter((s) =>
        status === 'active' ? Boolean(s.is_active) : !s.is_active
      );
    }
    const sorted = [...out];
    if (sort === 'name') sorted.sort((a, b) => a.name_en.localeCompare(b.name_en));
    else if (sort === 'code') sorted.sort((a, b) => a.code.localeCompare(b.code));
    else if (sort === 'routes') sorted.sort((a, b) => b.route_count - a.route_count);
    else if (sort === 'boardings') sorted.sort((a, b) => b.departures_30d - a.departures_30d);
    return sorted;
  }, [enrichedStops, q, status, sort]);

  /* ---------- CRUD ---------- */
  async function save() {
    if (!editing) return;
    const payload = {
      code: (editing.code || '').trim().toUpperCase(),
      name_rw: (editing.name_rw || '').trim(),
      name_en: (editing.name_en || '').trim(),
      lat: Number(editing.lat),
      lng: Number(editing.lng),
      is_active: editing.is_active === 0 || editing.is_active === false ? false : true
    };
    if (!payload.code || !payload.name_rw || !payload.name_en
        || !Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      setToast({ kind: 'err', msg: t('Uzuza ibisabwa byose.', 'Fill in all required fields.') });
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        await api.adminUpdateStop(editing.id, payload);
        setToast({ kind: 'ok', msg: t('Byahinduwe.', 'Stop updated.') });
      } else {
        await api.adminCreateStop(payload);
        setToast({ kind: 'ok', msg: t('Byongewe.', 'Stop created.') });
      }
      setEditing(null);
      refreshAll();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Stop) {
    try {
      await api.adminUpdateStop(s.id, { is_active: !Boolean(s.is_active) });
      setStops((cur) =>
        cur.map((x) => (x.id === s.id ? { ...x, is_active: !Boolean(x.is_active) } : x))
      );
      setToast({
        kind: 'ok',
        msg: !Boolean(s.is_active)
          ? t('Yongeye gukora.', 'Stop activated.')
          : t('Yahagaritswe.', 'Stop deactivated.')
      });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  async function remove(s: Stop) {
    const ok = await confirm({
      title: t('Gusiba ahantu', 'Delete stop'),
      message: t(
        `Gusiba ${s.code} — ${s.name_en}? Ibi bizasiba kandi aho hari kuri ingendo.`,
        `Delete ${s.code} — ${s.name_en}? This also removes it from all routes.`
      ),
      destructive: true,
      confirmLabel: t('Siba', 'Delete')
    });
    if (!ok) return;
    try {
      await api.adminDeleteStop(s.id);
      setToast({ kind: 'ok', msg: t('Byasibwe.', 'Stop deleted.') });
      refreshAll();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  /* ---------- Chart data ---------- */
  const routesPerStopData = useMemo(() => {
    if (!analytics) return [];
    return analytics.top_by_routes.map((s: any) => ({
      label: s.name_en,
      value: s.route_count,
      color: '#0ea5e9'
    }));
  }, [analytics]);

  const boardingsData = useMemo(() => {
    if (!analytics) return [];
    return analytics.top_by_boardings.map((s: any) => ({
      label: s.name_en,
      value: s.departures_30d,
      color: '#10b981'
    }));
  }, [analytics]);

  const revenueData = useMemo(() => {
    if (!analytics) return [];
    return analytics.top_by_revenue.map((s: any) => ({
      label: s.name_en,
      value: Math.round(s.revenue_30d / 100) / 10, // thousands RWF
      color: '#8b5cf6'
    }));
  }, [analytics]);

  const o = analytics?.overview;

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Ahantu ho guhagarara', 'Stops')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Gucunga ahantu n’isesengura ry’urubuga.',
              'Manage stops and see how they connect to the network.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/map"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200">
            {t('Reba ku ikarita', 'Open map')}
          </Link>
          <button
            onClick={() => setEditing({ is_active: 1, lat: -1.9441, lng: 30.0619 })}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            + {t('Ahantu hashya', 'New stop')}
          </button>
        </div>
      </header>

      {/* ---------- KPI strip ---------- */}
      {o && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={t('Ahantu hose', 'Total stops')} value={o.total} tone="slate" />
          <StatTile label={t('Bikora', 'Active')} value={o.active} tone="emerald" />
          <StatTile label={t('Bitagikora', 'Inactive')} value={o.inactive} tone="rose" />
          <StatTile
            label={t('Bitarafatanywa n’ingendo', 'Orphaned')}
            value={o.orphaned}
            tone="amber"
            hint={t('Nta ndege ibikoresha', 'Not on any route')}
          />
        </div>
      )}

      {/* ---------- Insights + Recommendations ---------- */}
      {analytics?.recommendations?.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-sky-950/20">
          <header className="flex items-center gap-2 border-b border-violet-200/60 px-5 py-3 dark:border-violet-900/40">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Sparkle />
            </span>
            <div>
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                {t('Incamake', 'Insights & recommendations')}
              </p>
              <p className="text-[10px] text-violet-600 dark:text-violet-400">
                {t('Bishingiye ku makuru y’urubuga', 'Grounded in live network data')}
              </p>
            </div>
          </header>
          <div className="grid gap-2 p-4 md:grid-cols-2">
            {analytics.recommendations.map((rec: any, i: number) => (
              <RecommendationCard key={i} {...rec} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Analytics grid ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top stops by routes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ahantu hahuza ingendo nyinshi', 'Most connected stops')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('Amatungo y’urubuga', 'Transfer hubs by route count')}
            </p>
          </div>
          {analyticsLoading ? (
            <Skeleton />
          ) : routesPerStopData.length === 0 ? (
            <EmptyChart />
          ) : (
            <BarChart data={routesPerStopData} vertical accent="#0ea5e9" />
          )}
        </section>

        {/* Top stops by boardings */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ahantu abantu bakundira', 'Busiest stops')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('Kwinjira · iminsi 30', 'Boardings · last 30 days')}
            </p>
          </div>
          {analyticsLoading ? (
            <Skeleton />
          ) : boardingsData.length === 0 ? (
            <EmptyChart />
          ) : (
            <BarChart data={boardingsData} vertical accent="#10b981" />
          )}
        </section>

        {/* Distribution */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ikwirakwizwa ry’ingendo', 'Route coverage')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('Abantu ku ngendo', 'Stops grouped by routes served')}
            </p>
          </div>
          {analyticsLoading ? (
            <Skeleton />
          ) : analytics?.route_distribution ? (
            <DonutChart data={analytics.route_distribution} size={180} thickness={20} />
          ) : (
            <EmptyChart />
          )}
        </section>
      </div>

      {/* ---------- Top revenue ---------- */}
      {revenueData.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('Amafaranga yinjira ku ahantu', 'Revenue by origin stop')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {t('Mu bihumbi by’amafaranga · iminsi 30', 'In thousands RWF · last 30 days')}
              </p>
            </div>
          </div>
          <BarChart data={revenueData} vertical accent="#8b5cf6" />
        </section>
      )}

      {/* ---------- Orphaned & duplicates alerts ---------- */}
      {(analytics?.orphaned?.length > 0 || analytics?.duplicates?.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {analytics?.orphaned?.length > 0 && (
            <Panel
              title={t('Ahantu hatagira ingendo', 'Orphaned stops')}
              subtitle={t('Nta ndege ibikoresha', 'Not served by any active route')}
              tone="amber"
            >
              <ul className="space-y-2">
                {analytics.orphaned.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-slate-900">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{s.name_en}</p>
                      <p className="text-[10px] text-slate-500">{s.code}</p>
                    </div>
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                    >
                      {t('Hindura', 'Edit')}
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {analytics?.duplicates?.length > 0 && (
            <Panel
              title={t('Ahantu hafi ya hamwe', 'Near-duplicate stops')}
              subtitle={t('Hafi ya metero 200', 'Within 200 metres of each other')}
              tone="violet"
            >
              <ul className="space-y-2">
                {analytics.duplicates.map((d: any, i: number) => (
                  <li key={i} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm dark:border-violet-900/50 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {d.a.name_en} · {d.b.name_en}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {d.a.code} · {d.b.code}
                        </p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                        {d.distance_m} m
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {/* ---------- Filter bar ---------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Shakisha', 'Search')}
            </span>
            <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('Kode cyangwa izina…', 'Code or name…')}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">✕</button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Imimerere', 'Status')}
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Byose', 'All')}</option>
              <option value="active">{t('Bikora', 'Active')}</option>
              <option value="inactive">{t('Bitagikora', 'Inactive')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Gutondeka', 'Sort by')}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="routes">{t('Ingendo nyinshi', 'Most routes')}</option>
              <option value="boardings">{t('Abantu benshi', 'Most boardings')}</option>
              <option value="name">{t('Izina', 'Name')}</option>
              <option value="code">{t('Kode', 'Code')}</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* ---------- Table ---------- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading && stops.length === 0 ? (
          <SkeletonTable />
        ) : filtered.length === 0 ? (
          <EmptyState
            t={t}
            hasFilters={q !== '' || status !== 'all'}
            onClear={() => { setQ(''); setStatus('all'); }}
            onCreate={() => setEditing({ is_active: 1, lat: -1.9441, lng: 30.0619 })}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('Kode', 'Code')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Izina', 'Name')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Aho hari', 'Location')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{t('Ingendo', 'Routes')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{t('Kwinjira', 'Boardings')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Imimerere', 'Status')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {s.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {lang === 'rw' ? s.name_rw : s.name_en}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {lang === 'rw' ? s.name_en : s.name_rw}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-slate-500">
                          {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RouteBadge count={s.route_count} t={t} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BoardingBadge count={s.departures_30d} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          Boolean(s.is_active)
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {Boolean(s.is_active) ? t('Irakora', 'Active') : t('Yahagaritswe', 'Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditing(s)}
                            className="rounded-md px-2 py-1 text-[11px] font-semibold text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
                          >
                            {t('Hindura', 'Edit')}
                          </button>
                          <button
                            onClick={() => toggleActive(s)}
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                              Boolean(s.is_active)
                                ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                            }`}
                          >
                            {Boolean(s.is_active) ? t('Hagarika', 'Pause') : t('Kora', 'Enable')}
                          </button>
                          <button
                            onClick={() => remove(s)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title={t('Siba', 'Delete')}
                          >
                            <Trash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {filtered.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-white">
                        {lang === 'rw' ? s.name_rw : s.name_en}
                      </p>
                      <p className="text-[10px] text-slate-500">{s.code}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <RouteBadge count={s.route_count} t={t} />
                        <BoardingBadge count={s.departures_30d} />
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          Boolean(s.is_active)
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {Boolean(s.is_active) ? t('Irakora', 'Active') : t('Yahagaritswe', 'Inactive')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(s)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        {t('Hindura', 'Edit')}
                      </button>
                      <button
                        onClick={() => remove(s)}
                        className="rounded-lg p-1.5 text-slate-400"
                      >
                        <Trash />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------- Modal ---------- */}
      {editing && (
        <StopModal
          editing={editing}
          setEditing={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          busy={busy}
          t={t}
        />
      )}

      {/* ---------- Toast ---------- */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-2xl ${
          toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Small pieces                                                       *
 * ================================================================== */
function StatTile({ label, value, tone, hint }: { label: string; value: number; tone: 'slate' | 'emerald' | 'rose' | 'amber'; hint?: string }) {
  const tones = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600 dark:text-amber-400'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, tone, children }: { title: string; subtitle?: string; tone: 'amber' | 'violet'; children: React.ReactNode }) {
  const border = tone === 'amber' ? 'border-amber-200 dark:border-amber-900/60' : 'border-violet-200 dark:border-violet-900/60';
  const header = tone === 'amber'
    ? 'border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
    : 'border-violet-200/60 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20';
  return (
    <section className={`overflow-hidden rounded-2xl border ${border} bg-white dark:bg-slate-900`}>
      <header className={`border-b ${header} px-5 py-3`}>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </header>
      <div className="max-h-[320px] overflow-auto p-4">{children}</div>
    </section>
  );
}

function RecommendationCard({ tone, title, body }: any) {
  const tones: Record<string, { dot: string; bg: string; border: string }> = {
    positive: { dot: 'bg-emerald-500', bg: 'bg-emerald-50/70 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900/40' },
    warning:  { dot: 'bg-amber-500',   bg: 'bg-amber-50/70 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-900/40' },
    info:     { dot: 'bg-sky-500',     bg: 'bg-sky-50/70 dark:bg-sky-950/20',       border: 'border-sky-200 dark:border-sky-900/40' }
  };
  const t = tones[tone] || tones.info;
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-3.5`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.dot}`} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
        </div>
      </div>
    </div>
  );
}

function RouteBadge({ count, t }: { count: number; t: any }) {
  const cls =
    count === 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    : count === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
    : count >= 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {count} {count === 1 ? t('urugendo', 'route') : t('ingendo', 'routes')}
    </span>
  );
}

function BoardingBadge({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  return (
    <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {count}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="py-10 text-center text-xs text-slate-500">
      No data available
    </p>
  );
}

function SkeletonTable() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ t, hasFilters, onClear, onCreate }: any) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <PinIcon />
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters ? t('Nta hantu hihuye n’ibisabwa', 'No stops match your filters') : t('Nta hantu hari', 'No stops yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure ibisabwa.', 'Try adjusting the filters.')
          : t('Kora ahantu ha mbere.', 'Create your first stop.')}
      </p>
      {hasFilters ? (
        <button onClick={onClear} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          {t('Siba filters', 'Clear filters')}
        </button>
      ) : (
        <button onClick={onCreate} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          + {t('Ahantu hashya', 'New stop')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Modal                                                              *
 * ================================================================== */
function StopModal({ editing, setEditing, onSave, onCancel, busy, t }: any) {
  const set = (patch: Partial<Stop>) => setEditing({ ...editing, ...patch });
  const isNew = !editing.id;

  return (
    <Modal
      open
      onClose={onCancel}
      title={isNew ? t('Ahantu hashya', 'New stop') : `${t('Hindura', 'Edit')} ${editing.code}`}
      wide
      footer={
        <>
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
          >
            {t('Reka', 'Cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? t('Turabika…', 'Saving…') : t('Bika', 'Save')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Kode', 'Code')} required hint={t('Nka ST-NYAB', 'e.g. ST-NYAB')}>
            <input
              value={editing.code || ''}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="ST-XXX"
              maxLength={30}
            />
          </Field>

          <Field label={t('Izina ry’ikinyarwanda', 'Name (Kinyarwanda)')} required>
            <input
              value={editing.name_rw || ''}
              onChange={(e) => set({ name_rw: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="Nyabugogo"
              maxLength={160}
            />
          </Field>
        </div>

        <Field label={t('Izina ry’icyongereza', 'Name (English)')} required>
          <input
            value={editing.name_en || ''}
            onChange={(e) => set({ name_en: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            placeholder="Nyabugogo"
            maxLength={160}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('Latitude', 'Latitude')}
            required
            hint={t('Nka -1.9441', 'e.g. -1.9441')}
          >
            <input
              type="number"
              step="0.0000001"
              value={editing.lat ?? ''}
              onChange={(e) => set({ lat: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="-1.9441"
            />
          </Field>
          <Field
            label={t('Longitude', 'Longitude')}
            required
            hint={t('Nka 30.0619', 'e.g. 30.0619')}
          >
            <input
              type="number"
              step="0.0000001"
              value={editing.lng ?? ''}
              onChange={(e) => set({ lng: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="30.0619"
            />
          </Field>
        </div>

        {/* Mini map preview */}
        {Number.isFinite(editing.lat) && Number.isFinite(editing.lng) && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
            <iframe
              title="stop-preview"
              width="100%"
              height="220"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ border: 0 }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${editing.lng - 0.005}%2C${editing.lat - 0.005}%2C${editing.lng + 0.005}%2C${editing.lat + 0.005}&layer=mapnik&marker=${editing.lat}%2C${editing.lng}`}
            />
          </div>
        )}

        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {t('Irakora', 'Active')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t(
                'Ahantu hadakora ntihagaragara ku rubuga rusanzwe.',
                'Inactive stops are hidden from the public site.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => set({ is_active: editing.is_active === 0 || editing.is_active === false ? 1 : 0 })}
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
              editing.is_active === 0 || editing.is_active === false ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                editing.is_active === 0 || editing.is_active === false ? 'left-0.5' : 'left-[22px]'
              }`}
            />
          </button>
        </label>
      </div>
    </Modal>
  );
}

function Field({ label, required, hint, children }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </label>
  );
}

/* ================================================================== *
 *  Icons                                                              *
 * ================================================================== */
function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}
function Trash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}