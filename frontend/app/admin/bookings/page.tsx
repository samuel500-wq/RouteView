'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Booking = any;
type Detail = any;

const PAGE_SIZES = [10, 20, 50, 100];

export default function AdminBookingsPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState('');
  const [type, setType] = useState<'all' | 'urban' | 'intercity'>('all');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [data, setData] = useState<{ total: number; page: number; pageSize: number; rows: Booking[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<{ type: 'urban' | 'intercity'; id: number } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debouncedQ = useDebounce(q, 350);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.adminBookings({
      page,
      pageSize,
      status: status || undefined,
      type: type === 'all' ? undefined : type,
      q: debouncedQ || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined
    })
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, status, type, debouncedQ, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [pageSize, status, type, debouncedQ, dateFrom, dateTo]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true);
    api.adminBookingDetail(selected.type, selected.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const summary = useMemo(() => {
    if (!data) return null;
    const rows = data.rows;
    const paid = rows.filter((r) => r.status === 'paid').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const revenue = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount_rwf, 0);
    return { total: data.total, paid, pending, revenue };
  }, [data]);

  function clearFilters() {
    setStatus('');
    setType('all');
    setQ('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  const activeFilters = [
    status && { key: 'status', label: status, clear: () => setStatus('') },
    type !== 'all' && { key: 'type', label: type, clear: () => setType('all') },
    debouncedQ && { key: 'q', label: `"${debouncedQ}"`, clear: () => setQ('') },
    dateFrom && { key: 'from', label: `from ${dateFrom}`, clear: () => setDateFrom('') },
    dateTo && { key: 'to', label: `to ${dateTo}`, clear: () => setDateTo('') }
  ].filter(Boolean) as any[];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Ingendo zose', 'All bookings')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('Urban na interprovincial', 'Urban and interprovincial bookings')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/validate"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200">
            {t('Genzura bileti', 'Validate ticket')}
          </Link>
          <button
            onClick={() => api.adminBookings({ page, pageSize, status: status || undefined, type: type === 'all' ? undefined : type, q: debouncedQ || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }).then(setData)}
            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            {t('Vugurura', 'Refresh')}
          </button>
        </div>
      </header>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryTile label={t('Zose', 'Matching')} value={summary.total.toLocaleString()} tone="slate" />
          <SummaryTile label={t('Zishyuwe', 'Paid')} value={summary.paid.toLocaleString()} tone="emerald" />
          <SummaryTile label={t('Zitegereje', 'Pending')} value={summary.pending.toLocaleString()} tone="amber" />
          <SummaryTile
            label={t('Amafaranga (iyi page)', 'Revenue (this page)')}
            value={`${summary.revenue.toLocaleString()} RWF`}
            tone="sky"
          />
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={q} onChange={setQ} t={t} />

          <Select
            label={t('Ubwoko', 'Type')}
            value={type}
            onChange={(v: string) => setType(v as any)}
            options={[
              { value: 'all', label: t('Zose', 'All') },
              { value: 'urban', label: t('Mu mujyi', 'Urban') },
              { value: 'intercity', label: t('Interprovincial', 'Interprovincial') }
            ]}
          />

          <Select
            label={t('Imimerere', 'Status')}
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: t('Zose', 'All statuses') },
              { value: 'paid', label: t('Zishyuwe', 'Paid') },
              { value: 'pending', label: t('Zitegereje', 'Pending') },
              { value: 'cancelled', label: t('Zihagaritswe', 'Cancelled') },
              { value: 'expired', label: t('Zarangiye', 'Expired') },
              { value: 'refunded', label: t('Zasubijwe', 'Refunded') }
            ]}
          />

          <div className="flex items-end gap-2">
            <DateInput label={t('Kuva', 'From')} value={dateFrom} onChange={setDateFrom} />
            <DateInput label={t('Kugera', 'To')} value={dateTo} onChange={setDateTo} />
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {t('Filters', 'Filters')}:
            </span>
            {activeFilters.map((f: any) => (
              <button
                key={f.key}
                onClick={f.clear}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                {f.label}
                <span className="text-slate-400">✕</span>
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="text-[11px] font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              {t('Siba byose', 'Clear all')}
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading && !data ? (
          <SkeletonRows />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState t={t} onClear={clearFilters} hasFilters={activeFilters.length > 0} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-widest text-slate-500 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('Kode', 'Reference')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Umugenzi', 'Passenger')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Urugendo', 'Route')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Itariki', 'Travel')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('Amafaranga', 'Amount')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Imimerere', 'Status')}</th>
                    <th className="px-4 py-3 font-semibold">{t('Bileti', 'Ticket')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr
                      key={`${r.type}-${r.id}`}
                      onClick={() => setSelected({ type: r.type, id: r.id })}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${r.type === 'intercity' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                            {r.reference}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{r.passenger_name}</p>
                        <p className="truncate text-[11px] text-slate-500">{r.user_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: r.route_color }}
                          >
                            {r.type === 'intercity' ? 'IC' : r.route_code}
                          </span>
                          <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                            {r.type === 'intercity'
                              ? `${r.origin} → ${r.destination}`
                              : r.route_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {r.trip_departure
                          ? new Date(r.trip_departure).toLocaleString(undefined, {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                          {r.amount_rwf.toLocaleString()}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400">RWF</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        {r.ticket_status ? (
                          <TicketChip status={r.ticket_status} />
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[10px] font-semibold text-slate-400">→</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {data.rows.map((r) => (
                <li
                  key={`${r.type}-${r.id}`}
                  onClick={() => setSelected({ type: r.type, id: r.id })}
                  className="cursor-pointer px-4 py-3 transition active:bg-slate-50 dark:active:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${r.type === 'intercity' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                        <span className="font-mono text-[11px] text-slate-500">{r.reference}</span>
                      </div>
                      <p className="mt-1 truncate font-medium text-slate-900 dark:text-white">
                        {r.passenger_name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {r.type === 'intercity' ? `${r.origin} → ${r.destination}` : r.route_name}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <StatusChip status={r.status} />
                      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                        {r.amount_rwf.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{r.trip_departure ? new Date(r.trip_departure).toLocaleString() : '—'}</span>
                    {r.ticket_status && <TicketChip status={r.ticket_status} />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              {t('Kwerekana', 'Showing')}{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)}
              </span>{' '}
              {t('muri', 'of')}{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {data.total.toLocaleString()}
              </span>
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s} / {t('page', 'page')}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <PageBtn onClick={() => setPage(1)} disabled={page === 1} label="«" />
            <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} label="‹" />
            <span className="px-3 text-xs text-slate-500">
              {t('Urupapuro', 'Page')}{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{page}</span>{' '}
              {t('muri', 'of')} {totalPages}
            </span>
            <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="›" />
            <PageBtn onClick={() => setPage(totalPages)} disabled={page === totalPages} label="»" />
          </div>
        </div>
      )}

      {selected && (
        <DetailDrawer
          selected={selected}
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelected(null)}
          t={t}
        />
      )}
    </div>
  );
}

/* ================================================================== */

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'amber' | 'sky' }) {
  const tones = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    sky: 'text-sky-600 dark:text-sky-400'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function SearchInput({ value, onChange, t }: any) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {t('Shakisha', 'Search')}
      </span>
      <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-400">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ref, name, email, route…"
          className="w-full bg-transparent px-2 py-2.5 text-sm outline-none dark:text-white"
        />
        {value && (
          <button onClick={() => onChange('')} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">✕</button>
        )}
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      >
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function DateInput({ label, value, onChange }: any) {
  return (
    <label className="block flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    refunded: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] || map.pending}`}>
      {status}
    </span>
  );
}

function TicketChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    issued: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    used: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
    redeemed: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status] || map.issued}`}>
      {status}
    </span>
  );
}

function PageBtn({ onClick, disabled, label }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ t, onClear, hasFilters }: any) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400" strokeLinecap="round">
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
        </svg>
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">
        {hasFilters ? t('Nta ngendo zihuye n’ibisabwa', 'No bookings match your filters') : t('Nta ngendo zirahari', 'No bookings yet')}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {hasFilters
          ? t('Gerageza uhindure filters.', 'Try adjusting the filters.')
          : t('Ingendo zizagaragara hano iyo abagenzi batangiye kugura bileti.', 'Bookings appear here as passengers purchase tickets.')}
      </p>
      {hasFilters && (
        <button onClick={onClear} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
          {t('Siba filters', 'Clear filters')}
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Detail drawer                                                      *
/* ================================================================== */

function DetailDrawer({ selected, detail, loading, onClose, t }: any) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:max-w-lg">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-sky-950 px-5 py-4 text-white dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {selected.type === 'intercity' ? t('Interprovincial', 'Interprovincial') : t('Mu mujyi', 'Urban')} {t('booking', 'booking')}
            </p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold">
              {detail?.booking?.reference || '…'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          )}

          {!loading && !detail && (
            <p className="py-12 text-center text-sm text-slate-500">
              {t('Ntibishobotse kubona amakuru.', 'Could not load booking details.')}
            </p>
          )}

          {!loading && detail && selected.type === 'urban' && <UrbanDetail detail={detail} t={t} />}
          {!loading && detail && selected.type === 'intercity' && <IntercityDetail detail={detail} t={t} />}
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[10px] text-slate-400">
            {t('Kanda Escape cyangwa hanze kugira ngo ufunge.', 'Press Escape or click outside to close.')}
          </p>
        </footer>
      </aside>
    </div>
  );
}

function UrbanDetail({ detail, t }: any) {
  const { booking: b, route, user, ticket } = detail;
  return (
    <div className="space-y-4">
      <Section title={t('Umugenzi', 'Passenger')}>
        <Row label={t('Amazina', 'Name')} value={b.passenger_name} />
        {b.passenger_phone && <Row label={t('Telefone', 'Phone')} value={b.passenger_phone} mono />}
        <Row label={t('Email', 'Email')} value={user?.email || '—'} mono />
        {b.seat_number && <Row label={t('Umwanya', 'Seat')} value={`#${b.seat_number}`} />}
      </Section>

      <Section title={t('Urugendo', 'Route')}>
        <Row label={t('Kode', 'Code')} value={route.code} badgeColor={route.color} />
        <Row label={t('Izina', 'Name')} value={route.name_en} />
        <Row label={t('Kuva', 'From')} value={route.from_stop} />
        <Row label={t('Kugera', 'To')} value={route.to_stop} />
        <Row label={t('Igihe', 'Departure')} value={new Date(b.depart_at).toLocaleString()} />
      </Section>

      <Section title={t('Kwishyura', 'Payment')}>
        <Row label={t('Amafaranga', 'Amount')} value={`${b.amount_rwf.toLocaleString()} RWF`} bold />
        <Row label={t('Imimerere', 'Status')} value={b.status} chip />
        <Row label={t('Byakozwe', 'Created')} value={new Date(b.created_at).toLocaleString()} />
      </Section>

      {ticket && (
        <Section title={t('Bileti', 'Ticket')}>
          <Row label={t('Kode', 'Code')} value={ticket.code} mono />
          <Row label={t('Imimerere', 'Status')} value={ticket.status} chip />
          {ticket.issued_at && <Row label={t('Yatanzwe', 'Issued')} value={new Date(ticket.issued_at).toLocaleString()} />}
          {ticket.used_at && <Row label={t('Yakoreshejwe', 'Used')} value={new Date(ticket.used_at).toLocaleString()} />}
        </Section>
      )}
    </div>
  );
}

function IntercityDetail({ detail, t }: any) {
  const { booking: b, trip, route, company, user, ticket } = detail;
  return (
    <div className="space-y-4">
      <Section title={t('Umugenzi', 'Passenger')}>
        <Row label={t('Amazina', 'Name')} value={b.passenger_name} />
        {b.passenger_phone && <Row label={t('Telefone', 'Phone')} value={b.passenger_phone} mono />}
        {b.passenger_email && <Row label={t('Email', 'Email')} value={b.passenger_email} mono />}
        {b.passenger_id_no && <Row label={t('Indangamuntu', 'National ID')} value={b.passenger_id_no} mono />}
        {b.seat_number && <Row label={t('Umwanya', 'Seat')} value={`#${b.seat_number}`} />}
      </Section>

      <Section title={t('Urugendo', 'Journey')}>
        <Row label={t('Kuva', 'From')} value={`${route.origin_city} · ${route.origin_terminal}`} />
        <Row label={t('Kugera', 'To')} value={`${route.destination_city} · ${route.destination_terminal}`} />
        <Row label={t('Intera', 'Distance')} value={`${route.distance_km} km`} />
        <Row
          label={t('Igihe', 'Duration')}
          value={`${Math.floor(route.duration_min / 60)}h ${route.duration_min % 60}m`}
        />
        <Row label={t('Itariki', 'Departure')} value={new Date(trip.departure_dt).toLocaleString()} />
        <Row label={t('Intara', 'Province')} value={route.province} />
      </Section>

      <Section title={t('Sosiyete', 'Operator')}>
        <Row label={t('Izina', 'Company')} value={company.name} />
        {company.phone && <Row label={t('Telefone', 'Phone')} value={company.phone} mono />}
        <Row label={t('Imodoka', 'Plate')} value={trip.plate_number || '—'} mono />
        {trip.driver_name && <Row label={t('Umudereva', 'Driver')} value={trip.driver_name} />}
        <Row label={t('Ubwoko', 'Class')} value={trip.bus_type} />
      </Section>

      <Section title={t('Kwishyura', 'Payment')}>
        <Row label={t('Amafaranga', 'Amount')} value={`${b.amount_rwf.toLocaleString()} RWF`} bold />
        <Row label={t('Imimerere', 'Status')} value={b.status} chip />
        <Row label={t('Byakozwe', 'Created')} value={new Date(b.created_at).toLocaleString()} />
      </Section>

      {ticket && (
        <Section title={t('Bileti', 'Ticket')}>
          <Row label={t('Kode', 'Code')} value={ticket.code} mono />
          <Row label={t('Imimerere', 'Status')} value={ticket.status} chip />
          {ticket.issued_at && <Row label={t('Yatanzwe', 'Issued')} value={new Date(ticket.issued_at).toLocaleString()} />}
          {ticket.used_at && <Row label={t('Yakoreshejwe', 'Used')} value={new Date(ticket.used_at).toLocaleString()} />}
          {ticket.scanned_plate && <Row label={t('Yasomwe kuri', 'Scanned at')} value={ticket.scanned_plate} mono />}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function Row({ label, value, bold, mono, chip, badgeColor }: any) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="flex-shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className={`truncate text-right ${bold ? 'text-base font-bold' : 'font-medium'} text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {badgeColor ? (
          <span className="rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: badgeColor }}>
            {value}
          </span>
        ) : chip ? (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {value}
          </span>
        ) : value}
      </dd>
    </div>
  );
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<any>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), ms);
    return () => timer.current && clearTimeout(timer.current);
  }, [value, ms]);
  return debounced;
}