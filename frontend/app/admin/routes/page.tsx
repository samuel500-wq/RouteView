'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/Confirm';

type Route = {
  id: number;
  code: string;
  name_rw: string;
  name_en: string;
  direction_label: string;
  color_hex: string;
  is_active: number | boolean;
  stop_count?: number;
};

const PRESET_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#ef4444', '#14b8a6', '#6366f1'
];

export default function AdminRoutesPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const confirm = useConfirm();

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'code' | 'name' | 'stops'>('code');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Partial<Route> | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.adminListRoutes();
      setRoutes(r.routes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(() => {
    let out = routes;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((r) =>
        `${r.code} ${r.name_en} ${r.name_rw} ${r.direction_label}`
          .toLowerCase()
          .includes(needle)
      );
    }
    if (filter !== 'all') {
      out = out.filter((r) =>
        filter === 'active' ? Boolean(r.is_active) : !r.is_active
      );
    }
    const sorted = [...out];
    if (sort === 'name') {
      sorted.sort((a, b) =>
        (lang === 'rw' ? a.name_rw : a.name_en).localeCompare(
          lang === 'rw' ? b.name_rw : b.name_en
        )
      );
    } else if (sort === 'stops') {
      sorted.sort((a, b) => (b.stop_count || 0) - (a.stop_count || 0));
    } else {
      sorted.sort((a, b) => a.code.localeCompare(b.code));
    }
    return sorted;
  }, [routes, q, sort, filter, lang]);

  async function save() {
    if (!editing) return;
    const payload = {
      code: (editing.code || '').trim().toUpperCase(),
      name_rw: (editing.name_rw || '').trim(),
      name_en: (editing.name_en || '').trim(),
      direction_label: (editing.direction_label || '').trim(),
      color_hex: editing.color_hex || '#0ea5e9',
      is_active: editing.is_active === 0 || editing.is_active === false ? false : true
    };
    if (!payload.code || !payload.name_rw || !payload.name_en || !payload.direction_label) {
      setToast({ kind: 'err', msg: t('Uzuza ibisabwa byose.', 'Fill in all required fields.') });
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        await api.adminUpdateRoute(editing.id, payload);
        setToast({ kind: 'ok', msg: t('Byahinduwe.', 'Route updated.') });
      } else {
        await api.adminCreateRoute(payload);
        setToast({ kind: 'ok', msg: t('Byongewe.', 'Route created.') });
      }
      setEditing(null);
      refresh();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(r: Route) {
    try {
      await api.adminUpdateRoute(r.id, { is_active: !Boolean(r.is_active) });
      setRoutes((cur) =>
        cur.map((x) => (x.id === r.id ? { ...x, is_active: !Boolean(x.is_active) } : x))
      );
      setToast({
        kind: 'ok',
        msg: !Boolean(r.is_active)
          ? t('Yongeye gukora.', 'Route activated.')
          : t('Yahagaritswe.', 'Route deactivated.')
      });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  async function remove(r: Route) {
    const ok = await confirm({
      title: t('Gusiba ingendo', 'Delete route'),
      message: t(
        `Gusiba ${r.code} — ${r.name_en}? Ibi bizasiba kandi ahantu h’iyi ngendo.`,
        `Delete ${r.code} — ${r.name_en}? This also removes its stops.`
      ),
      destructive: true,
      confirmLabel: t('Siba', 'Delete')
    });
    if (!ok) return;
    try {
      await api.adminDeleteRoute(r.id);
      setToast({ kind: 'ok', msg: t('Byasibwe.', 'Route deleted.') });
      refresh();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  const total = routes.length;
  const active = routes.filter((r) => Boolean(r.is_active)).length;
  const inactive = total - active;
  const totalStops = routes.reduce((s, r) => s + (r.stop_count || 0), 0);

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Ingendo z’umujyi', 'Urban routes')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Gucunga ingendo, amabara n’imiterere yazo.',
              'Manage routes, colours and their status.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/routes"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200">
            {t('Reba ku rubuga', 'Public view')}
          </Link>
          <button
            onClick={() => setEditing({ color_hex: '#0ea5e9', is_active: 1 })}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            + {t('Ingendo nshya', 'New route')}
          </button>
        </div>
      </header>

      {/* ---------- Stat strip ---------- */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label={t('Ingendo zose', 'Total routes')} value={total} tone="slate" />
        <StatTile label={t('Zikora', 'Active')} value={active} tone="emerald" />
        <StatTile label={t('Zahagaritswe', 'Inactive')} value={inactive} tone="rose" />
        <StatTile label={t('Ahantu hose', 'Total stops')} value={totalStops} tone="sky" />
      </div>

      {/* ---------- Controls ---------- */}
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
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Zose', 'All')}</option>
              <option value="active">{t('Zikora gusa', 'Active only')}</option>
              <option value="inactive">{t('Zahagaritswe gusa', 'Inactive only')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Gutondeka', 'Sort')}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="code">{t('Kode', 'Code')}</option>
              <option value="name">{t('Izina', 'Name')}</option>
              <option value="stops">{t('Ahantu', 'Stops')}</option>
            </select>
          </label>
        </div>
      </section>

      {/* ---------- Error ---------- */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* ---------- List ---------- */}
      {loading && routes.length === 0 ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState
          t={t}
          hasFilters={q !== '' || filter !== 'all'}
          onClear={() => { setQ(''); setFilter('all'); }}
          onCreate={() => setEditing({ color_hex: '#0ea5e9', is_active: 1 })}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <RouteCard
                route={r}
                lang={lang}
                t={t}
                onEdit={() => setEditing(r)}
                onToggle={() => toggleActive(r)}
                onDelete={() => remove(r)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* ---------- Modal ---------- */}
      {editing && (
        <RouteModal
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
          toast.kind === 'ok'
            ? 'bg-emerald-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Route card                                                         *
 * ================================================================== */
function RouteCard({
  route: r, lang, t, onEdit, onToggle, onDelete
}: {
  route: Route;
  lang: 'rw' | 'en';
  t: any;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const active = Boolean(r.is_active);
  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      {/* Colour bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: r.color_hex }} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 min-w-[56px] items-center justify-center rounded-xl px-2 text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: r.color_hex }}
            >
              {r.code}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">
                {lang === 'rw' ? r.name_rw : r.name_en}
              </p>
              <p className="truncate text-[11px] text-slate-500">{r.direction_label}</p>
            </div>
          </div>

          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {active ? t('Irakora', 'Active') : t('Yahagaritswe', 'Inactive')}
          </span>
        </div>

        {/* Info grid */}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <InfoCell label={t('Ahantu', 'Stops')} value={String(r.stop_count ?? 0)} />
          <InfoCell
            label={t('Ibara', 'Colour')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: r.color_hex }} />
                <span className="font-mono text-[10px]">{r.color_hex}</span>
              </span>
            }
          />
        </dl>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/routes/${r.id}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            {t('Reba', 'View')}
          </Link>
          <button
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            {t('Hindura', 'Edit')}
          </button>
          <button
            onClick={onToggle}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
            }`}
          >
            {active ? t('Hagarika', 'Deactivate') : t('Kora', 'Activate')}
          </button>
          <button
            onClick={onDelete}
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title={t('Siba', 'Delete')}
          >
            <Trash />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'emerald' | 'rose' | 'sky' }) {
  const tones = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-red-600 dark:text-red-400',
    sky: 'text-sky-600 dark:text-sky-400'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function EmptyState({ t, hasFilters, onClear, onCreate }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <RouteIcon />
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters ? t('Nta ndege ihuye n’ibisabwa', 'No routes match your filters') : t('Nta ndege zirahari', 'No routes yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure ibisabwa.', 'Try adjusting the filters.')
          : t('Kora ingendo ya mbere.', 'Create your first route.')}
      </p>
      {hasFilters ? (
        <button onClick={onClear} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          {t('Siba filters', 'Clear filters')}
        </button>
      ) : (
        <button onClick={onCreate} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          + {t('Ingendo nshya', 'New route')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Modal                                                              *
 * ================================================================== */
function RouteModal({ editing, setEditing, onSave, onCancel, busy, t }: any) {
  const set = (patch: Partial<Route>) => setEditing({ ...editing, ...patch });
  const isNew = !editing.id;

  return (
    <Modal
      open
      onClose={onCancel}
      title={isNew ? t('Ingendo nshya', 'New route') : `${t('Hindura', 'Edit')} ${editing.code}`}
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
          <Field label={t('Kode', 'Code')} required hint={t('Nka R1, R2', 'e.g. R1, R2')}>
            <input
              value={editing.code || ''}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="R1"
              maxLength={20}
            />
          </Field>

          <Field label={t('Ijambo ry’icyerekezo', 'Direction label')} required hint={t('Urugero: Outbound', 'e.g. Outbound')}>
            <input
              value={editing.direction_label || ''}
              onChange={(e) => set({ direction_label: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="Outbound"
              maxLength={160}
            />
          </Field>
        </div>

        <Field label={t('Izina mu Kinyarwanda', 'Name (Kinyarwanda)')} required>
          <input
            value={editing.name_rw || ''}
            onChange={(e) => set({ name_rw: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            placeholder="Nyabugogo – Kimironko"
            maxLength={160}
          />
        </Field>

        <Field label={t('Izina mu Cyongereza', 'Name (English)')} required>
          <input
            value={editing.name_en || ''}
            onChange={(e) => set({ name_en: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            placeholder="Nyabugogo – Kimironko"
            maxLength={160}
          />
        </Field>

        {/* Colour */}
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('Ibara ry’urugendo', 'Route colour')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set({ color_hex: c })}
                className={`h-9 w-9 rounded-xl border-2 transition ${
                  editing.color_hex === c
                    ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-white dark:ring-white/30'
                    : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              >
                {editing.color_hex === c && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950">
              <input
                type="color"
                value={editing.color_hex || '#0ea5e9'}
                onChange={(e) => set({ color_hex: e.target.value })}
                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="font-mono text-[11px] text-slate-500">
                {editing.color_hex || '#0ea5e9'}
              </span>
            </label>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {t('Igaragaza', 'Preview')}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className="flex h-12 min-w-[64px] items-center justify-center rounded-xl px-3 text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: editing.color_hex || '#0ea5e9' }}
            >
              {editing.code || 'R1'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">
                {editing.name_en || t('Izina ry’urugendo', 'Route name')}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {editing.direction_label || t('Icyerekezo', 'Direction')}
              </p>
            </div>
          </div>
        </div>

        {/* Active toggle */}
        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {t('Irakora', 'Active')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t(
                'Ingendo zidakora ntizigaragara ku rubuga rusanzwe.',
                'Inactive routes are hidden from the public site.'
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
function Trash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" />
      <path d="M6 18 C 10 12, 14 12, 18 6" strokeDasharray="0 4" />
    </svg>
  );
}