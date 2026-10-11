'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/Confirm';

type Vehicle = {
  id: number;
  plate: string;
  label: string;
  capacity: number;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  created_at?: string;
  last_seen?: string | null;
  // joined from live feed
  route_code?: string | null;
  route_color?: string | null;
  lat?: number | null;
  lng?: number | null;
  speed_kmh?: number | null;
  source?: 'gps' | 'simulator' | 'manual' | null;
  age_seconds?: number | null;
  passengers?: number | null;
  next_stop?: string | null;
  simulated?: boolean;
};

const STATUS_OPTIONS: { value: Vehicle['status']; label_rw: string; label_en: string }[] = [
  { value: 'active',      label_rw: 'Irakora',        label_en: 'Active' },
  { value: 'idle',        label_rw: 'Irategereje',    label_en: 'Idle' },
  { value: 'maintenance', label_rw: 'Iri mu kubungabunga', label_en: 'Maintenance' },
  { value: 'offline',     label_rw: 'Irafunze',       label_en: 'Offline' }
];

export default function AdminVehiclesPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const confirm = useConfirm();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [liveById, setLiveById] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Vehicle['status']>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'live' | 'simulated' | 'offline'>('all');
  const [sort, setSort] = useState<'plate' | 'capacity' | 'activity'>('plate');

  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  /* ---------- Load vehicles + live feed ---------- */
  async function loadVehicles() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.adminListVehicles();
      setVehicles(r.vehicles);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLive() {
    try {
      const r = await api.vehicles();
      const m = new Map<number, any>();
      for (const v of r.vehicles) m.set(v.vehicle_id, v);
      setLiveById(m);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadVehicles();
    loadLive();
    const id = setInterval(loadLive, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Merge live data ---------- */
  const enriched = useMemo<Vehicle[]>(() => {
    return vehicles.map((v) => {
      const live = liveById.get(v.id);
      if (!live) {
        return {
          ...v,
          lat: null, lng: null, speed_kmh: null, source: null,
          age_seconds: null, route_code: null, route_color: null,
          passengers: null, next_stop: null, simulated: false
        };
      }
      return {
        ...v,
        lat: live.lat,
        lng: live.lng,
        speed_kmh: live.speed_kmh,
        source: live.source,
        age_seconds: live.age_seconds,
        route_code: live.route_code,
        route_color: live.color_hex,
        passengers: live.passengers,
        next_stop: live.next_stop?.name_en || null,
        simulated: !!live.simulated
      };
    });
  }, [vehicles, liveById]);

  /* ---------- Filter + sort ---------- */
  const filtered = useMemo(() => {
    let out = enriched;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((v) =>
        `${v.plate} ${v.label} ${v.route_code || ''} ${v.next_stop || ''}`
          .toLowerCase()
          .includes(needle)
      );
    }
    if (statusFilter !== 'all') out = out.filter((v) => v.status === statusFilter);

    if (sourceFilter === 'live') out = out.filter((v) => v.source === 'gps');
    else if (sourceFilter === 'simulated') out = out.filter((v) => v.simulated);
    else if (sourceFilter === 'offline') out = out.filter((v) => !v.source);

    const sorted = [...out];
    if (sort === 'capacity') sorted.sort((a, b) => b.capacity - a.capacity);
    else if (sort === 'activity') {
      sorted.sort((a, b) => {
        const aAge = a.age_seconds ?? 99999;
        const bAge = b.age_seconds ?? 99999;
        return aAge - bAge;
      });
    } else sorted.sort((a, b) => a.plate.localeCompare(b.plate));
    return sorted;
  }, [enriched, q, statusFilter, sourceFilter, sort]);

  /* ---------- Stats ---------- */
  const stats = useMemo(() => {
    const total = enriched.length;
    const live = enriched.filter((v) => v.source).length;
    const simulated = enriched.filter((v) => v.simulated).length;
    const gps = enriched.filter((v) => v.source === 'gps').length;
    const offline = total - live;
    const inMaint = enriched.filter((v) => v.status === 'maintenance').length;
    const totalCapacity = enriched.reduce((s, v) => s + v.capacity, 0);
    const activePassengers = enriched.reduce((s, v) => s + (v.passengers || 0), 0);
    return { total, live, simulated, gps, offline, inMaint, totalCapacity, activePassengers };
  }, [enriched]);

  /* ---------- CRUD ---------- */
  async function save() {
    if (!editing) return;
    const payload = {
      plate: (editing.plate || '').trim().toUpperCase(),
      label: (editing.label || '').trim(),
      capacity: Number(editing.capacity) || 30,
      status: editing.status || 'idle'
    };
    if (!payload.plate || !payload.label || payload.capacity < 1) {
      setToast({ kind: 'err', msg: t('Uzuza ibisabwa byose.', 'Fill in all required fields.') });
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        await api.adminUpdateVehicle(editing.id, payload);
        setToast({ kind: 'ok', msg: t('Byahinduwe.', 'Vehicle updated.') });
      } else {
        await api.adminCreateVehicle(payload);
        setToast({ kind: 'ok', msg: t('Byongewe.', 'Vehicle added.') });
      }
      setEditing(null);
      loadVehicles();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function quickStatus(v: Vehicle, status: Vehicle['status']) {
    try {
      await api.adminUpdateVehicle(v.id, { status });
      setVehicles((cur) => cur.map((x) => (x.id === v.id ? { ...x, status } : x)));
      setToast({ kind: 'ok', msg: t('Imimerere yahinduwe.', 'Status changed.') });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  async function remove(v: Vehicle) {
    const ok = await confirm({
      title: t('Gusiba imodoka', 'Delete vehicle'),
      message: t(
        `Gusiba ${v.plate} — ${v.label}? Ibi ntibishobora gusubijwe.`,
        `Delete ${v.plate} — ${v.label}? This cannot be undone.`
      ),
      destructive: true,
      confirmLabel: t('Siba', 'Delete')
    });
    if (!ok) return;
    try {
      await api.adminDeleteVehicle(v.id);
      setToast({ kind: 'ok', msg: t('Byasibwe.', 'Vehicle deleted.') });
      loadVehicles();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  return (
    <div className="space-y-5">
      {/* =================== Header =================== */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Imodoka', 'Vehicles')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Gucunga ibisi, imiterere n’aho ziri ubu.',
              'Manage the fleet, status and live positions.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/map"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200">
            {t('Reba ku ikarita', 'Open map')}
          </Link>
          <button
            onClick={() => setEditing({ status: 'idle', capacity: 30 })}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            + {t('Imodoka nshya', 'New vehicle')}
          </button>
        </div>
      </header>

      {/* =================== Fleet overview strip =================== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t('Imodoka zose', 'Total vehicles')}
          value={stats.total}
          hint={`${stats.totalCapacity} ${t('imyanya', 'seats')}`}
          tone="slate"
          icon={<TruckIcon />}
        />
        <StatTile
          label={t('Ziri gukora ubu', 'Live now')}
          value={stats.live}
          hint={`${stats.simulated} ${t('ibigereranyo', 'simulated')}`}
          tone="emerald"
          pulse
          icon={<PulseIcon />}
        />
        <StatTile
          label={t('Abagenzi mu bisi', 'Passengers aboard')}
          value={stats.activePassengers}
          hint={t('Ku bisi zikora gusa', 'Only on live vehicles')}
          tone="sky"
          icon={<UsersIcon />}
        />
        <StatTile
          label={t('Iri mu kubungabunga', 'In maintenance')}
          value={stats.inMaint}
          hint={`${stats.offline} ${t('zitari ku murongo', 'offline')}`}
          tone="amber"
          icon={<WrenchIcon />}
        />
      </div>

      {/* =================== Live fleet card =================== */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-6 text-white shadow-lg dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg">
            <PulseIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Imiterere y’urubuga', 'Network status')}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {stats.live > 0
                ? t(
                    `${stats.live} mu ${stats.total} bisi ziri ku muhanda ubu.`,
                    `${stats.live} of ${stats.total} vehicles are on the road right now.`
                  )
                : t(
                    'Nta bisi ziri ku muhanda ubu.',
                    'No vehicles are on the road right now.'
                  )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {stats.gps > 0 && `${stats.gps} ${t('GPS', 'GPS')}`}
              {stats.gps > 0 && stats.simulated > 0 && ' · '}
              {stats.simulated > 0 && `${stats.simulated} ${t('ibigereranyo', 'simulated')}`}
            </p>
          </div>
          <Link href="/map"
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold backdrop-blur transition hover:bg-white/20">
            {t('Reba ku ikarita', 'View on map')} →
          </Link>
        </div>

        {/* Mini live distribution */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
          <MiniStat label={t('GPS', 'GPS feed')} value={stats.gps} dotClass="bg-emerald-400" />
          <MiniStat label={t('Ibigereranyo', 'Simulated')} value={stats.simulated} dotClass="bg-amber-400" />
          <MiniStat label={t('Zitari ku murongo', 'Offline')} value={stats.offline} dotClass="bg-slate-400" />
        </div>
      </section>

      {/* =================== Filters =================== */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
                placeholder={t('Nomero, izina, ingendo…', 'Plate, label, route…')}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white"
              />
              {q && <button onClick={() => setQ('')} className="text-slate-400">✕</button>}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Imimerere', 'Status')}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Zose', 'All statuses')}</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {lang === 'rw' ? o.label_rw : o.label_en}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Akamaro', 'Feed')}
            </span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Byose', 'All feeds')}</option>
              <option value="live">{t('GPS gusa', 'GPS only')}</option>
              <option value="simulated">{t('Ibigereranyo', 'Simulated only')}</option>
              <option value="offline">{t('Zitari ku murongo', 'Offline only')}</option>
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
              <option value="plate">{t('Nomero', 'Plate')}</option>
              <option value="capacity">{t('Ubushobozi', 'Capacity')}</option>
              <option value="activity">{t('Ibikorwa vuba', 'Most recently active')}</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* =================== Grid of vehicles =================== */}
      {loading && vehicles.length === 0 ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          t={t}
          hasFilters={q !== '' || statusFilter !== 'all' || sourceFilter !== 'all'}
          onClear={() => { setQ(''); setStatusFilter('all'); setSourceFilter('all'); }}
          onCreate={() => setEditing({ status: 'idle', capacity: 30 })}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <li key={v.id}>
              <VehicleCard
                vehicle={v}
                lang={lang}
                t={t}
                onEdit={() => setEditing(v)}
                onDelete={() => remove(v)}
                onQuickStatus={(s) => quickStatus(v, s)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* =================== Modal =================== */}
      {editing && (
        <VehicleModal
          editing={editing}
          setEditing={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          busy={busy}
          lang={lang}
          t={t}
        />
      )}

      {/* =================== Toast =================== */}
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
 *  Vehicle card                                                       *
 * ================================================================== */
function VehicleCard({
  vehicle: v, lang, t, onEdit, onDelete, onQuickStatus
}: {
  vehicle: Vehicle;
  lang: 'rw' | 'en';
  t: any;
  onEdit: () => void;
  onDelete: () => void;
  onQuickStatus: (s: Vehicle['status']) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLive = !!v.source;
  const isSim = !!v.simulated;
  const age = v.age_seconds ?? null;

  const statusTone = statusStyles(v.status, t);

  // Occupancy ratio
  const occupancy = v.passengers != null && v.capacity > 0
    ? v.passengers / v.capacity
    : null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      {/* Colour bar (route colour if live, otherwise status colour) */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: v.route_color || statusTone.bar }}
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Top row: plate + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${statusTone.iconBg} ${statusTone.iconFg}`}>
              <TruckIcon />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white">
                {v.plate}
              </p>
              <p className="truncate text-[11px] text-slate-500">{v.label}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                {isSim ? t('ikigereranyo', 'sim') : 'GPS'}
              </span>
            )}
            {!isLive && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {t('itari ku murongo', 'offline')}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusTone.chip}`}>
              {statusTone.label}
            </span>
          </div>
        </div>

        {/* Middle: current assignment if live */}
        {isLive && v.route_code ? (
          <div className="mt-4 space-y-2.5">
            {/* Route badge + next stop */}
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 min-w-[34px] items-center justify-center rounded-md px-2 text-[10px] font-bold text-white"
                style={{ backgroundColor: v.route_color || '#0ea5e9' }}
              >
                {v.route_code}
              </span>
              {v.next_stop && (
                <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                  {t('Akurikira', 'Next')}: <span className="font-medium text-slate-900 dark:text-white">{v.next_stop}</span>
                </p>
              )}
            </div>

            {/* Occupancy bar */}
            {occupancy != null && (
              <div>
                <div className="flex items-baseline justify-between text-[10px]">
                  <span className="font-medium text-slate-500">
                    {t('Abagenzi', 'Passengers')}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {v.passengers} / {v.capacity}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((occupancy || 0) * 100))}%`,
                      backgroundColor: occupancy > 0.85 ? '#f59e0b' : occupancy > 0.6 ? '#0ea5e9' : '#10b981'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Speed + age */}
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>
                {v.speed_kmh != null && `🚀 ${Math.round(v.speed_kmh)} km/h`}
              </span>
              {age != null && <span>{formatAge(age, t)}</span>}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 flex-col justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-4 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-[11px] text-slate-500">
              {v.last_seen
                ? t(
                    `Yaheruka kugaragara ${formatAge(Math.round((Date.now() - new Date(v.last_seen).getTime()) / 1000), t)} ishize`,
                    `Last seen ${formatAge(Math.round((Date.now() - new Date(v.last_seen).getTime()) / 1000), t)} ago`
                  )
                : t('Ntirasohoka ku murongo', 'Has never reported a position')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            {t('Hindura', 'Edit')}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
              title={t('Hindura imimerere', 'Change status')}
            >
              {t('Imimerere', 'Status')} ▾
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full right-0 z-40 mb-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => { onQuickStatus(s.value); setMenuOpen(false); }}
                      disabled={v.status === s.value}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        {lang === 'rw' ? s.label_rw : s.label_en}
                      </span>
                      {v.status === s.value && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-sky-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title={t('Siba', 'Delete')}
          >
            <Trash />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  Small pieces                                                       *
 * ================================================================== */
function StatTile({
  label, value, hint, tone, pulse, icon
}: {
  label: string;
  value: number;
  hint?: string;
  tone: 'slate' | 'emerald' | 'sky' | 'amber';
  pulse?: boolean;
  icon?: React.ReactNode;
}) {
  const tones = {
    slate:   { fg: 'text-slate-900 dark:text-white',     bg: 'bg-slate-100 dark:bg-slate-800',       icon: 'text-slate-600 dark:text-slate-300' },
    emerald: { fg: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', icon: 'text-emerald-600 dark:text-emerald-400' },
    sky:     { fg: 'text-sky-600 dark:text-sky-400',      bg: 'bg-sky-50 dark:bg-sky-950/40',         icon: 'text-sky-600 dark:text-sky-400' },
    amber:   { fg: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40',     icon: 'text-amber-600 dark:text-amber-400' }
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones.bg} ${tones.icon}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-2xl font-bold tabular-nums ${tones.fg}`}>{value.toLocaleString()}</p>
        {pulse && value > 0 && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        )}
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      <div>
        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function EmptyState({ t, hasFilters, onClear, onCreate }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <TruckIcon />
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters ? t('Nta modoka ihuye n’ibisabwa', 'No vehicles match your filters') : t('Nta modoka zirahari', 'No vehicles yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure ibisabwa.', 'Try adjusting the filters.')
          : t('Ongeraho imodoka ya mbere.', 'Add your first vehicle.')}
      </p>
      {hasFilters ? (
        <button onClick={onClear} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          {t('Siba filters', 'Clear filters')}
        </button>
      ) : (
        <button onClick={onCreate} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          + {t('Imodoka nshya', 'New vehicle')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Modal                                                              *
 * ================================================================== */
function VehicleModal({ editing, setEditing, onSave, onCancel, busy, lang, t }: any) {
  const set = (patch: Partial<Vehicle>) => setEditing({ ...editing, ...patch });
  const isNew = !editing.id;

  return (
    <Modal
      open
      onClose={onCancel}
      title={isNew ? t('Imodoka nshya', 'New vehicle') : `${t('Hindura', 'Edit')} ${editing.plate}`}
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
        {/* Preview card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('Igaragaza', 'Preview')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <TruckIcon />
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white">
                {editing.plate || 'RAD 000 X'}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {editing.label || t('Izina ry’imodoka', 'Vehicle label')}
              </p>
            </div>
            <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {(STATUS_OPTIONS.find((s) => s.value === (editing.status || 'idle')) as any)?.[lang === 'rw' ? 'label_rw' : 'label_en']}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Nomero y’imodoka', 'Plate number')} required hint={t('Nka RAD 123 A', 'e.g. RAD 123 A')}>
            <input
              value={editing.plate || ''}
              onChange={(e) => set({ plate: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="RAD 123 A"
              maxLength={30}
            />
          </Field>

          <Field label={t('Izina', 'Label')} required hint={t('Nka Bus 01', 'e.g. Bus 01')}>
            <input
              value={editing.label || ''}
              onChange={(e) => set({ label: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="Bus 01"
              maxLength={80}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Ubushobozi bw’abagenzi', 'Passenger capacity')} required hint={t('Nka 30', 'e.g. 30')}>
            <input
              type="number"
              min={1}
              max={200}
              value={editing.capacity ?? 30}
              onChange={(e) => set({ capacity: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </Field>

          <Field label={t('Imimerere', 'Status')} required>
            <select
              value={editing.status || 'idle'}
              onChange={(e) => set({ status: e.target.value as Vehicle['status'] })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {lang === 'rw' ? s.label_rw : s.label_en}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
          {t(
            'Imodoka "active" gusa nizikoreshwa na simulator. Iyo ushyize kuri "maintenance" cyangwa "offline", ntizizongera kugaragara ku ikarita.',
            'Only "active" vehicles are used by the simulator. Once set to "maintenance" or "offline", they stop appearing on the live map.'
          )}
        </div>
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
 *  Status styles                                                      *
 * ================================================================== */
function statusStyles(status: Vehicle['status'], t: any) {
  switch (status) {
    case 'active':
      return {
        label: t('Irakora', 'Active'),
        chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
        iconFg: 'text-emerald-600 dark:text-emerald-400',
        bar: '#10b981'
      };
    case 'idle':
      return {
        label: t('Irategereje', 'Idle'),
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
        iconBg: 'bg-sky-100 dark:bg-sky-950/50',
        iconFg: 'text-sky-600 dark:text-sky-400',
        bar: '#0ea5e9'
      };
    case 'maintenance':
      return {
        label: t('Kubungabunga', 'Maintenance'),
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-950/50',
        iconFg: 'text-amber-600 dark:text-amber-400',
        bar: '#f59e0b'
      };
    default:
      return {
        label: t('Irafunze', 'Offline'),
        chip: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        iconBg: 'bg-slate-100 dark:bg-slate-800',
        iconFg: 'text-slate-500 dark:text-slate-400',
        bar: '#94a3b8'
      };
  }
}

/* ================================================================== *
 *  Helpers                                                            *
 * ================================================================== */
function formatAge(seconds: number, t: any) {
  if (seconds < 60) return `${seconds}${t('s', 's')}`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}${t('m', 'm')}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${t('h', 'h')}`;
  return `${Math.floor(h / 24)}${t('d', 'd')}`;
}

/* ================================================================== *
 *  Icons                                                              *
 * ================================================================== */
function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Z" />
      <path d="M4 12h16M8 20v-2M16 20v-2" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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