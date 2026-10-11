'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { useConfirm } from '@/components/Confirm';

/* ================================================================== *
 *  Types
 * ================================================================== */

type Severity = 'info' | 'warning' | 'critical';

type Alert = {
  id: number;
  route_id: number | null;
  route_code?: string | null;
  severity: Severity;
  title_rw: string;
  title_en: string;
  body_rw: string;
  body_en: string;
  starts_at: string;
  ends_at: string | null;
  is_active: number | boolean;
  created_at?: string;
  created_by?: number | null;
};

const SEVERITIES: { value: Severity; label_rw: string; label_en: string }[] = [
  { value: 'info',     label_rw: 'Amakuru',   label_en: 'Info' },
  { value: 'warning',  label_rw: 'Iburira',   label_en: 'Warning' },
  { value: 'critical', label_rw: 'Bikomeye',  label_en: 'Critical' }
];

/* ================================================================== *
 *  Page
 * ================================================================== */

export default function AdminAlertsPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const confirm = useConfirm();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'inactive'>('all');
  const [routeFilter, setRouteFilter] = useState<number | 'all'>('all');

  const [editing, setEditing] = useState<Partial<Alert> | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  /* ---------- Load ---------- */

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [a, r] = await Promise.all([
        api.adminListAlerts(),
        api.listRoutes()
      ]);
      setAlerts(a.alerts);
      setRoutes(r.routes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Classify each alert ---------- */

  const enriched = useMemo(() => {
    const now = Date.now();
    return alerts.map((a) => {
      const startsAt = new Date(a.starts_at).getTime();
      const endsAt = a.ends_at ? new Date(a.ends_at).getTime() : null;
      const active = Boolean(a.is_active);
      let state: 'active' | 'scheduled' | 'expired' | 'inactive';
      if (!active) state = 'inactive';
      else if (startsAt > now) state = 'scheduled';
      else if (endsAt && endsAt < now) state = 'expired';
      else state = 'active';
      return { ...a, state };
    });
  }, [alerts]);

  /* ---------- Filter + sort ---------- */

  const filtered = useMemo(() => {
    let out = enriched;
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((a) =>
        `${a.title_en} ${a.title_rw} ${a.body_en} ${a.body_rw} ${a.route_code || ''}`
          .toLowerCase()
          .includes(needle)
      );
    }
    if (severityFilter !== 'all') out = out.filter((a) => a.severity === severityFilter);
    if (stateFilter !== 'all') out = out.filter((a) => a.state === stateFilter);
    if (routeFilter !== 'all') out = out.filter((a) => a.route_id === routeFilter);

    // Sort: active first, then scheduled, then others; within group by start time
    const order: Record<string, number> = { active: 0, scheduled: 1, inactive: 2, expired: 3 };
    return [...out].sort((a, b) => {
      const d = order[a.state] - order[b.state];
      if (d !== 0) return d;
      return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
    });
  }, [enriched, q, severityFilter, stateFilter, routeFilter]);

  /* ---------- Stats ---------- */

  const stats = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((a) => a.state === 'active').length;
    const scheduled = enriched.filter((a) => a.state === 'scheduled').length;
    const critical = enriched.filter((a) => a.severity === 'critical' && a.state === 'active').length;
    const affectedRoutes = new Set(enriched.filter((a) => a.state === 'active' && a.route_id).map((a) => a.route_id)).size;
    return { total, active, scheduled, critical, affectedRoutes };
  }, [enriched]);

  /* ---------- CRUD ---------- */

  async function save() {
    if (!editing) return;

    const payload = {
      route_id: editing.route_id ? Number(editing.route_id) : null,
      severity: editing.severity || 'info',
      title_rw: (editing.title_rw || '').trim(),
      title_en: (editing.title_en || '').trim(),
      body_rw: (editing.body_rw || '').trim(),
      body_en: (editing.body_en || '').trim(),
      starts_at: editing.starts_at || new Date().toISOString(),
      ends_at: editing.ends_at || null,
      is_active: editing.is_active === 0 || editing.is_active === false ? false : true
    };

    if (!payload.title_rw || !payload.title_en || !payload.body_rw || !payload.body_en) {
      setToast({ kind: 'err', msg: t('Uzuza ibisabwa byose.', 'Fill in all required fields.') });
      return;
    }

    setBusy(true);
    try {
      if (editing.id) {
        await api.adminUpdateAlert(editing.id, payload);
        setToast({ kind: 'ok', msg: t('Byahinduwe.', 'Alert updated.') });
      } else {
        await api.adminCreateAlert(payload);
        setToast({ kind: 'ok', msg: t('Byongewe.', 'Alert published.') });
      }
      setEditing(null);
      refresh();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: Alert) {
    try {
      await api.adminUpdateAlert(a.id, { is_active: !Boolean(a.is_active) });
      setAlerts((cur) =>
        cur.map((x) => (x.id === a.id ? { ...x, is_active: !Boolean(x.is_active) } : x))
      );
      setToast({
        kind: 'ok',
        msg: !Boolean(a.is_active)
          ? t('Yatangijwe.', 'Alert activated.')
          : t('Yahagaritswe.', 'Alert paused.')
      });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  async function remove(a: Alert) {
    const ok = await confirm({
      title: t('Gusiba itangazo', 'Delete alert'),
      message: t(
        `Gusiba "${a.title_en}"? Ibi ntibishobora gusubijwe.`,
        `Delete "${a.title_en}"? This cannot be undone.`
      ),
      destructive: true,
      confirmLabel: t('Siba', 'Delete')
    });
    if (!ok) return;
    try {
      await api.adminDeleteAlert(a.id);
      setToast({ kind: 'ok', msg: t('Byasibwe.', 'Alert deleted.') });
      refresh();
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Itangazo ry’ingendo', 'Service alerts')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Menyesha abagenzi ku bibazo, impinduka cyangwa ibindi bibaye ku rubuga.',
              'Notify passengers about disruptions, changes, or special events on the network.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200"
          >
            {t('Reba ku rubuga', 'Public view')}
          </Link>
          <button
            onClick={() => setEditing(emptyAlert())}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            + {t('Itangazo rishya', 'New alert')}
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t('Itangazo rikora ubu', 'Active alerts')}
          value={stats.active}
          hint={`${stats.scheduled} ${t('bitegereje', 'scheduled')}`}
          tone="emerald"
          pulse={stats.active > 0}
          icon={<Bell />}
        />
        <StatTile
          label={t('Ibikomeye', 'Critical')}
          value={stats.critical}
          hint={t('Bigomba gukemurwa vuba', 'Require prompt attention')}
          tone="rose"
          icon={<Alert />}
        />
        <StatTile
          label={t('Ingendo zibabajwe', 'Routes affected')}
          value={stats.affectedRoutes}
          hint={t('Ku rubuga rwose', 'Across the network')}
          tone="amber"
          icon={<RouteIcon />}
        />
        <StatTile
          label={t('Byose', 'Total alerts')}
          value={stats.total}
          hint={t('Mu bubiko bwose', 'In the archive')}
          tone="slate"
          icon={<Archive />}
        />
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Shakisha', 'Search')}
            </span>
            <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('Mutwe cyangwa ibisobanuro…', 'Title or description…')}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white"
              />
              {q && (
                <button
                  onClick={() => setQ('')}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Urwego', 'Severity')}
            </span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Byose', 'All severities')}</option>
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {lang === 'rw' ? s.label_rw : s.label_en}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Imimerere', 'State')}
            </span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Byose', 'All states')}</option>
              <option value="active">{t('Bikora', 'Active')}</option>
              <option value="scheduled">{t('Bitegereje', 'Scheduled')}</option>
              <option value="expired">{t('Byarangiye', 'Expired')}</option>
              <option value="inactive">{t('Byahagaritswe', 'Paused')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Ingendo', 'Route')}
            </span>
            <select
              value={routeFilter === 'all' ? 'all' : String(routeFilter)}
              onChange={(e) => setRouteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">{t('Urubuga rwose', 'Network-wide')}</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {lang === 'rw' ? r.name_rw : r.name_en}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {/* List */}
      {loading && alerts.length === 0 ? (
        <SkeletonList />
      ) : filtered.length === 0 ? (
        <EmptyState
          t={t}
          hasFilters={q !== '' || severityFilter !== 'all' || stateFilter !== 'all' || routeFilter !== 'all'}
          onClear={() => {
            setQ('');
            setSeverityFilter('all');
            setStateFilter('all');
            setRouteFilter('all');
          }}
          onCreate={() => setEditing(emptyAlert())}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <li key={a.id}>
              <AlertRow
                alert={a}
                lang={lang}
                t={t}
                onEdit={() => setEditing(a)}
                onToggle={() => toggleActive(a)}
                onDelete={() => remove(a)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Modal */}
      {editing && (
        <AlertModal
          editing={editing}
          setEditing={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
          busy={busy}
          lang={lang}
          t={t}
          routes={routes}
        />
      )}

      {/* Toast */}
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
 *  Helpers
 * ================================================================== */

function emptyAlert(): Partial<Alert> {
  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago
  return {
    severity: 'info',
    is_active: 1,
    starts_at: toLocalISO(start),
    ends_at: ''
  };
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s);
}

/* ================================================================== *
 *  Alert row
 * ================================================================== */

function AlertRow({
  alert: a, lang, t, onEdit, onToggle, onDelete
}: {
  alert: Alert & { state: string };
  lang: 'rw' | 'en';
  t: any;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const sev = severityStyles(a.severity, t);
  const stateStyles = stateChipStyles(a.state, t);

  const starts = new Date(a.starts_at);
  const ends = a.ends_at ? new Date(a.ends_at) : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-white transition hover:shadow-md dark:bg-slate-900 ${
      a.state === 'active'
        ? 'border-slate-200 dark:border-slate-800'
        : 'border-slate-200 opacity-80 dark:border-slate-800'
    }`}>
      {/* Left accent stripe */}
      <span className={`absolute inset-y-0 left-0 w-1.5 ${sev.bar}`} />

      <div className="flex flex-col gap-4 pl-6 pr-5 py-4 lg:flex-row lg:items-start lg:gap-5">
        {/* Severity + state */}
        <div className="flex flex-wrap items-center gap-2 lg:w-40 lg:flex-col lg:items-start">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${sev.chip}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${stateStyles.chip}`}>
            {stateStyles.label}
          </span>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {lang === 'rw' ? a.title_rw : a.title_en}
            </h3>
            {a.route_code ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {a.route_code}
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {t('Urubuga rwose', 'Network-wide')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {lang === 'rw' ? a.body_rw : a.body_en}
          </p>

          {/* Date range */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock />
              {t('Kuva', 'From')}: {starts.toLocaleString()}
            </span>
            {ends && (
              <span className="inline-flex items-center gap-1">
                <Clock />
                {t('Kugera', 'Until')}: {ends.toLocaleString()}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Hash />
              #{a.id}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1 lg:flex-col lg:items-end">
          <button
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
          >
            {t('Hindura', 'Edit')}
          </button>
          <button
            onClick={onToggle}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              Boolean(a.is_active)
                ? 'border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/40'
                : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
            }`}
          >
            {Boolean(a.is_active) ? t('Hagarika', 'Pause') : t('Kora', 'Activate')}
          </button>
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
 *  Small tiles
 * ================================================================== */

function StatTile({
  label, value, hint, tone, pulse, icon
}: {
  label: string;
  value: number;
  hint?: string;
  tone: 'slate' | 'emerald' | 'amber' | 'rose';
  pulse?: boolean;
  icon?: React.ReactNode;
}) {
  const tones = {
    slate:   { fg: 'text-slate-900 dark:text-white',          bg: 'bg-slate-100 dark:bg-slate-800',        icon: 'text-slate-600 dark:text-slate-300' },
    emerald: { fg: 'text-emerald-600 dark:text-emerald-400',   bg: 'bg-emerald-50 dark:bg-emerald-950/40',  icon: 'text-emerald-600 dark:text-emerald-400' },
    amber:   { fg: 'text-amber-600 dark:text-amber-400',       bg: 'bg-amber-50 dark:bg-amber-950/40',      icon: 'text-amber-600 dark:text-amber-400' },
    rose:    { fg: 'text-red-600 dark:text-red-400',           bg: 'bg-red-50 dark:bg-red-950/40',          icon: 'text-red-600 dark:text-red-400' }
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

/* ================================================================== *
 *  Styles for severity and state
 * ================================================================== */

function severityStyles(sev: Severity, t: any) {
  switch (sev) {
    case 'critical':
      return {
        label: t('Bikomeye', 'Critical'),
        bar: 'bg-red-500',
        dot: 'bg-red-500',
        chip: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
      };
    case 'warning':
      return {
        label: t('Iburira', 'Warning'),
        bar: 'bg-amber-500',
        dot: 'bg-amber-500',
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      };
    default:
      return {
        label: t('Amakuru', 'Info'),
        bar: 'bg-sky-500',
        dot: 'bg-sky-500',
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      };
  }
}

function stateChipStyles(state: string, t: any) {
  switch (state) {
    case 'active':
      return {
        label: t('Irakora', 'Active'),
        chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      };
    case 'scheduled':
      return {
        label: t('Iteganyijwe', 'Scheduled'),
        chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
      };
    case 'expired':
      return {
        label: t('Yarangiye', 'Expired'),
        chip: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      };
    default:
      return {
        label: t('Yahagaritswe', 'Paused'),
        chip: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
      };
  }
}

/* ================================================================== *
 *  Skeleton + empty
 * ================================================================== */

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function EmptyState({ t, hasFilters, onClear, onCreate }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Bell />
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters
          ? t('Nta tangazo rihuye n’ibisabwa', 'No alerts match your filters')
          : t('Nta tangazo rirahari', 'No alerts yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure ibisabwa.', 'Try adjusting the filters.')
          : t('Tangaza ikibazo cyangwa impinduka ku rubuga.', 'Publish a disruption or a network change.')}
      </p>
      {hasFilters ? (
        <button
          onClick={onClear}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t('Siba filters', 'Clear filters')}
        </button>
      ) : (
        <button
          onClick={onCreate}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          + {t('Itangazo rishya', 'New alert')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== *
 *  Modal
 * ================================================================== */

function AlertModal({ editing, setEditing, onSave, onCancel, busy, lang, t, routes }: any) {
  const set = (patch: Partial<Alert>) => setEditing({ ...editing, ...patch });
  const isNew = !editing.id;

  const severities = SEVERITIES;
  const currentSeverity = editing.severity || 'info';
  const sev = severityStyles(currentSeverity, t);

  return (
    <Modal
      open
      onClose={onCancel}
      title={isNew ? t('Itangazo rishya', 'New alert') : `${t('Hindura', 'Edit')} #${editing.id}`}
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
        {/* Preview banner */}
        <div className={`relative overflow-hidden rounded-2xl border ${sevPreviewBorder(currentSeverity)} ${sevPreviewBg(currentSeverity)} p-4 dark:bg-slate-950/60`}>
          <span className={`absolute inset-y-0 left-0 w-1.5 ${sev.bar}`} />
          <div className="pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {t('Igaragaza', 'Preview')}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {editing.title_en || editing.title_rw || t('Mutwe w’itangazo', 'Alert title')}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {editing.body_en || editing.body_rw || t('Ibisobanuro by’itangazo bizagaragara hano.', 'The alert description will appear here.')}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
              <span className={`inline-block rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${sev.chip}`}>
                {sev.label}
              </span>
            </div>
          </div>
        </div>

        {/* Severity */}
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('Urwego', 'Severity')} <span className="text-red-500">*</span>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {severities.map((s) => {
              const selected = currentSeverity === s.value;
              const styles = severityStyles(s.value, t);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set({ severity: s.value })}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition ${
                    selected
                      ? 'border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700'
                  }`}
                >
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {lang === 'rw' ? s.label_rw : s.label_en}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Route selector */}
        <Field label={t('Ingendo', 'Route')} hint={t('Siga ubusa ku itangazo rusange', 'Leave empty for a network-wide alert')}>
          <select
            value={editing.route_id ?? ''}
            onChange={(e) => set({ route_id: e.target.value ? Number(e.target.value) : null })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          >
            <option value="">{t('Urubuga rwose', 'Network-wide')}</option>
            {routes.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.code} · {lang === 'rw' ? r.name_rw : r.name_en}
              </option>
            ))}
          </select>
        </Field>

        {/* Titles */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Mutwe (Kinyarwanda)', 'Title (Kinyarwanda)')} required>
            <input
              value={editing.title_rw || ''}
              onChange={(e) => set({ title_rw: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="Ubutumwa ku nzira"
              maxLength={180}
            />
          </Field>
          <Field label={t('Mutwe (English)', 'Title (English)')} required>
            <input
              value={editing.title_en || ''}
              onChange={(e) => set({ title_en: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              placeholder="Service notice"
              maxLength={180}
            />
          </Field>
        </div>

        {/* Bodies */}
        <Field label={t('Ibisobanuro (Kinyarwanda)', 'Description (Kinyarwanda)')} required>
          <textarea
            value={editing.body_rw || ''}
            onChange={(e) => set({ body_rw: e.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            placeholder="Tubwira abagenzi ko..."
          />
        </Field>
        <Field label={t('Ibisobanuro (English)', 'Description (English)')} required>
          <textarea
            value={editing.body_en || ''}
            onChange={(e) => set({ body_en: e.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            placeholder="Tell passengers that..."
          />
        </Field>

        {/* Time window */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Itangira', 'Starts at')} required>
            <input
              type="datetime-local"
              value={toLocalISO(new Date(editing.starts_at || new Date()))}
              onChange={(e) => set({ starts_at: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </Field>
          <Field
            label={t('Irangira (bidategetswe)', 'Ends at (optional)')}
            hint={t('Siga ubusa niba idafite iherezo', 'Leave empty if the alert has no end')}
          >
            <input
              type="datetime-local"
              value={editing.ends_at ? toLocalISO(new Date(editing.ends_at)) : ''}
              onChange={(e) => set({ ends_at: e.target.value || null })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </Field>
        </div>

        {/* Active toggle */}
        <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {t('Irakora', 'Active')}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t(
                'Itangazo ridakora ntirigaragara ku rubuga rusanzwe.',
                'Paused alerts are hidden from the public site.'
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

function sevPreviewBorder(sev: Severity) {
  if (sev === 'critical') return 'border-red-200 dark:border-red-900/60';
  if (sev === 'warning')  return 'border-amber-200 dark:border-amber-900/60';
  return 'border-sky-200 dark:border-sky-900/60';
}
function sevPreviewBg(sev: Severity) {
  if (sev === 'critical') return 'bg-red-50';
  if (sev === 'warning')  return 'bg-amber-50';
  return 'bg-sky-50';
}

/* ================================================================== *
 *  Icons
 * ================================================================== */

function Bell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
function Alert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M6 18 C 10 12, 14 12, 18 6" strokeDasharray="0 4" />
    </svg>
  );
}
function Archive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}
function Clock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}
function Hash() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
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