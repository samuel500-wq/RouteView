'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Issue = {
  id: string;
  ts: number;
  level: 'error' | 'warning' | 'info';
  source: string;
  message: string;
  detail: string | null;
  meta: any;
  resolved: boolean;
  resolvedAt: number | null;
  fix: string | null;
};

type ServiceState = { ok: boolean; [k: string]: any };

export default function AdminStatusPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [status, setStatus] = useState<any>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [busyFix, setBusyFix] = useState<string | null>(null);

  const [issueFilter, setIssueFilter] = useState<'all' | 'unresolved' | 'error' | 'warning'>('unresolved');

  /* ---------- Load everything ---------- */
  async function loadAll(showSpinner = true) {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const [s, i, d] = await Promise.all([
        api.adminSystemStatus().catch(() => null),
        api.adminSystemIssues({
          only_unresolved: issueFilter === 'unresolved' || issueFilter === 'all' ? undefined : undefined,
          level: issueFilter === 'error' || issueFilter === 'warning' ? issueFilter : undefined,
          limit: 50
        }).catch(() => ({ issues: [] })),
        api.adminDiagnostics().catch(() => null)
      ]);
      if (s) setStatus(s);
      setIssues(i.issues || []);
      if (d) setDiagnostics(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const id = setInterval(() => loadAll(false), 15000);
    return () => clearInterval(id);
  }, [issueFilter]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Apply a fix ---------- */
  async function fix(kind: string, successMsg?: string) {
    setBusyFix(kind);
    try {
      const r = await api.adminApplyFix(kind);
      setToast({
        kind: r.ok ? 'ok' : 'err',
        msg: successMsg || r.note || (r.ok ? t('Byakunze.', 'Done.') : t('Byanze.', 'Failed.'))
      });
      if (r.ok) await loadAll(false);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    } finally {
      setBusyFix(null);
    }
  }

  /* ---------- Resolve an issue ---------- */
  async function resolveIssue(id: string) {
    try {
      await api.adminResolveIssue(id);
      setIssues((cur) => cur.map((i) => (i.id === id ? { ...i, resolved: true, resolvedAt: Date.now() } : i)));
      setToast({ kind: 'ok', msg: t('Byakemuwe.', 'Marked as resolved.') });
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.message });
    }
  }

  /* ---------- Filtered issues ---------- */
  const filteredIssues = useMemo(() => {
    if (issueFilter === 'unresolved') return issues.filter((i) => !i.resolved);
    if (issueFilter === 'error') return issues.filter((i) => i.level === 'error');
    if (issueFilter === 'warning') return issues.filter((i) => i.level === 'warning');
    return issues;
  }, [issues, issueFilter]);

  /* ---------- Summary counts ---------- */
  const summary = useMemo(() => {
    if (!status) return null;
    const services = ['db', 'ml', 'ai', 'simulator', 'osrm', 'overpass'];
    const healthy = services.filter((s) => status[s]?.ok).length;
    return { healthy, total: services.length };
  }, [status]);

  if (loading && !status) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Imiterere ya sisitemu', 'System status')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Kugenzura no gukemura ibibazo by’urubuga.',
              'Monitor the platform and repair issues directly from this page.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
            summary && summary.healthy === summary.total
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : summary && summary.healthy > 0
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${
              summary && summary.healthy === summary.total ? 'bg-emerald-500'
              : summary && summary.healthy > 0 ? 'bg-amber-500' : 'bg-red-500'
            } ${refreshing ? 'animate-pulse' : ''}`} />
            {summary ? `${summary.healthy} / ${summary.total} ${t('bikora', 'healthy')}` : '—'}
          </span>
          <button
            onClick={() => loadAll(false)}
            disabled={refreshing}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
          >
            {refreshing ? t('Turashakisha…', 'Refreshing…') : t('Vugurura', 'Refresh')}
          </button>
        </div>
      </header>

      {/* ---------- Service cards ---------- */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          name={t('Database', 'Database')}
          subtitle={`${status?.db?.host || ''} · ${status?.db?.database || ''}`}
          service={status?.db}
          t={t}
          actions={[
            { label: t('Ping', 'Ping'), kind: 'reconnect_db' }
          ]}
          onFix={fix}
          busyFix={busyFix}
        />
        <ServiceCard
          name={t('ML service', 'ML service')}
          subtitle={status?.ml?.url || '—'}
          service={status?.ml}
          t={t}
          extra={status?.ml?.model_version && (
            <span className="text-[10px] text-slate-500">
              {t('Moderi', 'Model')} v{status.ml.model_version}
            </span>
          )}
          actions={[
            { label: t('Gerageza', 'Test'), kind: 'test_ml' }
          ]}
          onFix={fix}
          busyFix={busyFix}
        />
        <ServiceCard
          name={t('AI provider', 'AI provider')}
          subtitle={status?.ai?.model || '—'}
          service={status?.ai}
          t={t}
          extra={status?.ai?.key_prefix && (
            <span className="text-[10px] font-mono text-slate-500">{status.ai.key_prefix}</span>
          )}
          actions={
            status?.ai?.configured
              ? [{ label: t('Gerageza', 'Test'), kind: 'test_ai' }]
              : []
          }
          onFix={fix}
          busyFix={busyFix}
        />
        <ServiceCard
          name={t('Fleet simulator', 'Fleet simulator')}
          subtitle={`${status?.simulator?.vehicles || 0} ${t('bisi', 'vehicles')}`}
          service={status?.simulator}
          t={t}
          actions={[
            { label: t('Ongera utangire', 'Restart'), kind: 'restart_simulator' }
          ]}
          onFix={fix}
          busyFix={busyFix}
        />
        <ServiceCard
          name="OSRM"
          subtitle={t('Inzira z’imihanda', 'Road routing')}
          service={status?.osrm}
          t={t}
          actions={[
            { label: t('Siba cache', 'Clear cache'), kind: 'clear_osrm_cache' }
          ]}
          onFix={fix}
          busyFix={busyFix}
        />
        <ServiceCard
          name="Overpass"
          subtitle={t('Ahantu (OpenStreetMap)', 'Places (OpenStreetMap)')}
          service={status?.overpass}
          t={t}
          actions={[]}
          onFix={fix}
          busyFix={busyFix}
        />
      </section>

      {/* ---------- Backend info strip ---------- */}
      {status?.backend && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Seriveri', 'Backend process')}
            </h2>
            <span className="text-[10px] text-slate-400">
              {t('Env', 'Env')}: {status.backend.env}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCell label="Node" value={status.backend.node_version} />
            <InfoCell
              label={t('Igihe', 'Uptime')}
              value={formatUptime(status.backend.uptime_seconds)}
            />
            <InfoCell
              label={t('Memory', 'Memory')}
              value={`${status.backend.memory_mb} MB`}
              tone={status.backend.memory_mb > 500 ? 'amber' : undefined}
            />
            <InfoCell label="Port" value={String(status.backend.port)} />
          </dl>
        </section>
      )}

      {/* ---------- Database row counts ---------- */}
      {status?.db_stats && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Imibare y’ububiko', 'Database contents')}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fix('purge_positions')}
                disabled={busyFix === 'purge_positions'}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {busyFix === 'purge_positions' ? '…' : t('Siba positions za kera', 'Purge old positions')}
              </button>
              <button
                onClick={() => fix('purge_ai_history')}
                disabled={busyFix === 'purge_ai_history'}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {busyFix === 'purge_ai_history' ? '…' : t('Siba AI history', 'Purge AI history')}
              </button>
              <button
                onClick={() => fix('extend_intercity')}
                disabled={busyFix === 'extend_intercity'}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {busyFix === 'extend_intercity' ? '…' : t('Ongera intercity', 'Extend intercity')}
              </button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <CountCell label={t('Abakoresha', 'Users')}    value={status.db_stats.users} />
            <CountCell label={t('Ahantu', 'Stops')}         value={status.db_stats.stops} />
            <CountCell label={t('Ingendo', 'Routes')}       value={status.db_stats.routes} />
            <CountCell label={t('Imodoka', 'Vehicles')}     value={status.db_stats.vehicles} />
            <CountCell label={t('Ingendo za intercity', 'Intercity trips')} value={status.db_stats.intercity_trips} />
            <CountCell label={t('Bookings (urban)', 'Urban bookings')} value={status.db_stats.urban_bookings} />
            <CountCell label={t('Bookings (intercity)', 'Intercity bookings')} value={status.db_stats.intercity_bookings} />
            <CountCell label={t('Positions', 'Vehicle positions')} value={status.db_stats.vehicle_positions} />
            <CountCell label={t('AI messages', 'AI messages')} value={status.db_stats.ai_messages} />
          </dl>
        </section>
      )}

      {/* ---------- Diagnostics ---------- */}
      {diagnostics && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('Kugenzura urubuga', 'Network diagnostics')}
              </h2>
              <p className="text-[11px] text-slate-500">
                {diagnostics.total === 0
                  ? t('Nta kibazo kibonetse.', 'No issues detected.')
                  : t(
                      `${diagnostics.total} ibibazo byabonetse.`,
                      `${diagnostics.total} issue${diagnostics.total > 1 ? 's' : ''} detected.`
                    )}
              </p>
            </div>
            <button
              onClick={() => loadAll(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
            >
              {t('Ongera ugenzure', 'Re-run')}
            </button>
          </header>

          {diagnostics.issues.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                {t('Byose birasa neza.', 'Everything looks good.')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  'Nta kibazo cyabonetse mu bubiko, ingendo cyangwa ibisi.',
                  'No issues detected in the database, routes or fleet.'
                )}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {diagnostics.issues.map((issue: any, i: number) => (
                <li key={i} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <SeverityDot severity={issue.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{issue.message}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">{issue.area}</p>
                  </div>
                  {issue.fix && issue.fix !== 'manual' && (
                    <button
                      onClick={() => fix(issue.fix)}
                      disabled={busyFix === issue.fix}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    >
                      {busyFix === issue.fix ? '…' : t('Gukosora', 'Fix now')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---------- Error log ---------- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Ibibazo byanditswe', 'Recorded issues')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {status?.error_log
                ? `${status.error_log.total} ${t('byose', 'total')} · ${status.error_log.unresolved} ${t('bitarakemurwa', 'unresolved')} · ${status.error_log.last_hour} ${t('mu isaha', 'in the last hour')}`
                : '—'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterTab active={issueFilter === 'unresolved'} onClick={() => setIssueFilter('unresolved')}>
              {t('Bitarakemurwa', 'Unresolved')}
            </FilterTab>
            <FilterTab active={issueFilter === 'error'} onClick={() => setIssueFilter('error')}>
              {t('Amakosa', 'Errors')}
            </FilterTab>
            <FilterTab active={issueFilter === 'warning'} onClick={() => setIssueFilter('warning')}>
              {t('Iburira', 'Warnings')}
            </FilterTab>
            <FilterTab active={issueFilter === 'all'} onClick={() => setIssueFilter('all')}>
              {t('Byose', 'All')}
            </FilterTab>
            <button
              onClick={() => fix('clear_error_log')}
              disabled={busyFix === 'clear_error_log'}
              className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400"
            >
              {t('Siba log', 'Clear')}
            </button>
          </div>
        </header>

        {filteredIssues.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {issueFilter === 'unresolved'
              ? t('Nta kibazo kitarakemurwa.', 'No unresolved issues.')
              : t('Nta makosa yanditswe.', 'No issues logged.')}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredIssues.map((e) => (
              <IssueRow key={e.id} issue={e} onResolve={() => resolveIssue(e.id)} t={t} />
            ))}
          </ul>
        )}
      </section>

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
 *  Components
 * ================================================================== */

function ServiceCard({
  name, subtitle, service, t, extra, actions, onFix, busyFix
}: {
  name: string;
  subtitle?: string;
  service: ServiceState | undefined;
  t: any;
  extra?: React.ReactNode;
  actions: { label: string; kind: string }[];
  onFix: (kind: string) => void;
  busyFix: string | null;
}) {
  if (!service) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
        <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        <p className="mt-3 text-xs text-slate-400">{t('Turashakisha…', 'Loading…')}</p>
      </div>
    );
  }

  const ok = service.ok;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition ${
      ok
        ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
        : 'border-red-200 bg-red-50/30 dark:border-red-900/60 dark:bg-red-950/10'
    }`}>
      {/* Status dot top-right */}
      <span className={`absolute right-4 top-4 flex h-2.5 w-2.5 items-center justify-center rounded-full ${
        ok ? 'bg-emerald-500' : 'bg-red-500'
      }`}>
        {!ok && <span className="absolute inline-block h-2.5 w-2.5 animate-ping rounded-full bg-red-500 opacity-60" />}
      </span>

      <p className="pr-8 text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{subtitle}</p>
      {extra && <div className="mt-1">{extra}</div>}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
        <span className={`font-semibold uppercase tracking-wider ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {ok ? t('Irakora', 'Operational') : t('Ifunze', 'Down')}
        </span>
        {service.latency_ms != null && (
          <span className="text-slate-500">{service.latency_ms} ms</span>
        )}
      </div>

      {!ok && service.error && (
        <p className="mt-2 truncate rounded-lg bg-red-50 px-2 py-1 text-[10px] font-mono text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {service.error}
        </p>
      )}

      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <button
              key={a.kind}
              onClick={() => onFix(a.kind)}
              disabled={busyFix === a.kind}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
            >
              {busyFix === a.kind ? '…' : a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </dd>
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-white">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function FilterTab({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function SeverityDot({ severity }: { severity: 'error' | 'warning' | 'info' }) {
  const cls = severity === 'error' ? 'bg-red-500'
    : severity === 'warning' ? 'bg-amber-500'
    : 'bg-sky-500';
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${cls}`} />;
}

function IssueRow({ issue, onResolve, t }: { issue: Issue; onResolve: () => void; t: any }) {
  const [expanded, setExpanded] = useState(false);
  const color = issue.level === 'error' ? 'text-red-600 dark:text-red-400'
    : issue.level === 'warning' ? 'text-amber-600 dark:text-amber-400'
    : 'text-sky-600 dark:text-sky-400';

  return (
    <li className={`px-5 py-3 transition ${issue.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <SeverityDot severity={issue.level} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className={`text-sm font-medium ${color}`}>{issue.message}</p>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {issue.source}
            </span>
            {issue.resolved && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {t('Byakemuwe', 'Resolved')}
              </span>
            )}
          </div>

          {issue.meta?.path && (
            <p className="mt-0.5 text-[10px] font-mono text-slate-500">
              {issue.meta.method} {issue.meta.path}
            </p>
          )}

          <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
            <span>{timeAgo(issue.ts)}</span>
            {issue.detail && (
              <button
                onClick={() => setExpanded((x) => !x)}
                className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
              >
                {expanded ? t('Hisha', 'Hide') : t('Reba', 'Show')} {t('amakuru', 'details')}
              </button>
            )}
          </div>

          {expanded && issue.detail && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-200">
              {issue.detail}
            </pre>
          )}
        </div>

        {!issue.resolved && (
          <button
            onClick={onResolve}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
          >
            {t('Kemura', 'Resolve')}
          </button>
        )}
      </div>
    </li>
  );
}

/* ================================================================== *
 *  Helpers
 * ================================================================== */

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return `${h}h ${rm}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}