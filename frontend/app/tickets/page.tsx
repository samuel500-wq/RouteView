'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import Modal from '@/components/Modal';

export default function TicketsPage() {
  const { user, loading, logout } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600 dark:border-slate-800 dark:border-t-sky-400" />
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return <IntercityHome onLogout={logout} />;
}

/* ================================================================== */
/*  Intercity home                                                     */
/* ================================================================== */

function IntercityHome({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [step, setStep] = useState<'search' | 'results' | 'bookings'>('search');
  const [origins, setOrigins] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [from, setFrom] = useState('Kigali');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [openTicket, setOpenTicket] = useState<number | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.intercityDestinations().then((r) => setOrigins(r.origins)).catch(() => {});
  }, []);

  useEffect(() => {
    setTo('');
    api.intercityDestinations(from).then((r) => setDestinations(r.destinations)).catch(() => {});
  }, [from]);

  async function search(destOverride?: string, fromOverride?: string) {
    const f = fromOverride ?? from;
    const d = destOverride ?? to;
    if (!d) return;
    setErr(null);
    setLoadingTrips(true);
    try {
      const r = await api.intercitySearch(d, date, f);
      setTrips(r.trips);
      setStep('results');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoadingTrips(false);
    }
  }

  async function refreshBookings() {
    setLoadingBookings(true);
    try {
      const r = await api.intercityMyBookings();
      setBookings(r.bookings);
    } finally {
      setLoadingBookings(false);
    }
  }

  useEffect(() => { refreshBookings(); }, []);

  function handlePrint(ticket: any) {
    setPrintData(ticket);
    setTimeout(() => window.print(), 150);
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-base font-bold text-white">
                {(user?.full_name || 'U').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {t('Bileti z’ingendo', 'Interprovincial tickets')}
                </h1>
                <p className="truncate text-xs text-slate-500">
                  {user?.email} · {user?.full_name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user?.role === 'operator' || user?.role === 'admin') && (
              <Link
                href="/admin/validate"
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200"
              >
                {t('Genzura / Soma QR', 'Validate / Scan')}
              </Link>
            )}
            <button
              onClick={onLogout}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              {t('Sohoka', 'Sign out')}
            </button>
          </div>
        </header>

        {/* Step tabs */}
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          <StepTab active={step === 'search'} onClick={() => setStep('search')}>
            {t('Shakisha', 'Search')}
          </StepTab>
          <StepTab
            active={step === 'results' && trips.length > 0}
            onClick={() => setStep('results')}
            disabled={trips.length === 0}
          >
            {t('Ihitamo', 'Results')}{trips.length > 0 ? ` · ${trips.length}` : ''}
          </StepTab>
          <StepTab
            active={step === 'bookings'}
            onClick={() => { setStep('bookings'); refreshBookings(); }}
          >
            {t('Bileti zanjye', 'My tickets')}{bookings.length > 0 ? ` · ${bookings.length}` : ''}
          </StepTab>
        </div>

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        )}

        {step === 'search' && (
          <SearchPanel
            origins={origins}
            destinations={destinations}
            from={from} setFrom={setFrom}
            to={to} setTo={setTo}
            date={date} setDate={setDate}
            onSearch={() => search()}
            onQuickSearch={(f: string, d: string) => search(d, f)}
            loading={loadingTrips}
            t={t}
          />
        )}

        {step === 'results' && (
          <ResultsPanel
            trips={trips}
            from={from}
            destination={to}
            date={date}
            onBack={() => setStep('search')}
            onBook={(trip: any) => setSelectedTrip(trip)}
            t={t}
          />
        )}

        {step === 'bookings' && (
          <BookingsPanel
            bookings={bookings}
            loading={loadingBookings}
            onShowTicket={(id: number) => setOpenTicket(id)}
            onRefresh={refreshBookings}
            onSearch={() => setStep('search')}
            t={t}
          />
        )}

        {selectedTrip && (
          <BookModal
            trip={selectedTrip}
            onClose={() => setSelectedTrip(null)}
            onCreated={async () => {
              await refreshBookings();
              setStep('bookings');
            }}
          />
        )}

        {openTicket != null && (
          <TicketModal
            bookingId={openTicket}
            onClose={() => setOpenTicket(null)}
            onPrint={handlePrint}
          />
        )}
      </div>

      {printData && <PrintableTicket data={printData} />}
    </>
  );
}

/* ================================================================== */
/*  Search panel                                                       */
/* ================================================================== */

function SearchPanel({
  origins, destinations, from, setFrom, to, setTo,
  date, setDate, onSearch, onQuickSearch, loading, t
}: any) {
  const popular = destinations.slice(0, 8);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
              {t('Uva', 'From')}
            </span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              {origins.map((o: any) => (
                <option key={o.city} value={o.city}>{o.city}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
              {t('Ujya', 'To')}
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            >
              <option value="">{t('Hitamo aho ujya', 'Select destination')}</option>
              {destinations.map((d: any) => (
                <option key={d.city} value={d.city}>
                  {d.city}{d.province ? ` — ${d.province}` : ''} · {d.distance_km} km
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
              {t('Itariki', 'Date')}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={onSearch}
              disabled={!to || loading}
              className="w-full rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 lg:w-auto"
            >
              {loading ? '…' : t('Shakisha', 'Search')}
            </button>
          </div>
        </div>

        {/* Quick chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-medium text-slate-500">
            {t('Vuba:', 'Quick:')}
          </span>
          {[
            { f: 'Kigali', d: 'Musanze' },
            { f: 'Kigali', d: 'Rubavu' },
            { f: 'Kigali', d: 'Huye' },
            { f: 'Musanze', d: 'Kigali' },
            { f: 'Rubavu', d: 'Kigali' },
            { f: 'Huye', d: 'Kigali' },
            { f: 'Musanze', d: 'Rubavu' }
          ].map((q, i) => (
            <button
              key={i}
              onClick={() => { setFrom(q.f); setTo(q.d); onQuickSearch(q.f, q.d); }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
            >
              {q.f} → {q.d}
            </button>
          ))}
        </div>
      </section>

      {/* Popular destinations */}
      {popular.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('Ahantu hakunzwe', 'Popular from')} {from}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((d: any) => (
              <button
                key={d.city}
                onClick={() => { setTo(d.city); onQuickSearch(from, d.city); }}
                className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-500"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {d.province || '—'}
                  </span>
                  <span className="text-slate-300 group-hover:text-sky-500">→</span>
                </div>
                <p className="mt-3 text-base font-bold text-slate-900 dark:text-white">{d.city}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {d.distance_km} km · ~{Math.round(d.duration_min / 60 * 10) / 10} h
                </p>
                <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {t('Kuva', 'from')} {d.from_price_rwf.toLocaleString()} RWF
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Results panel                                                      */
/* ================================================================== */

function ResultsPanel({ trips, from, destination, date, onBack, onBook, t }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200"
        >
          ← {t('Hindura', 'Change search')}
        </button>
        <div>
          <p className="text-xs text-slate-500">{t('Urugero', 'Route')}</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {from} → {destination}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-500">{t('Itariki', 'Date')}</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-white">
            {t('Nta ngendo kuri iyi tariki', 'No trips on this date')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {t('Gerageza indi tariki.', 'Try a different date.')}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip: any) => (
            <TripCard key={trip.trip_id} trip={trip} onBook={() => onBook(trip)} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TripCard({ trip, onBook, t }: any) {
  const departure = new Date(trip.departure_dt);
  const arrival = new Date(trip.arrival_dt);
  const duration = `${Math.floor(trip.route.duration_min / 60)}h ${trip.route.duration_min % 60}m`;
  const seatsLow = trip.seats_available <= 5;

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {departure.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              {trip.route.origin_city}
            </p>
          </div>
          <div className="flex flex-1 items-center gap-2 text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="relative h-px flex-1 bg-slate-200 dark:bg-slate-700">
              <span className="absolute inset-x-0 -top-2 text-center text-[10px] font-medium text-slate-500">
                {duration} · {trip.route.distance_km} km
              </span>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {arrival.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-slate-500">
              {trip.route.destination_city}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:flex-col lg:items-end">
          <div className="lg:text-right">
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {trip.price_rwf.toLocaleString()} <span className="text-xs font-normal text-slate-500">RWF</span>
            </p>
            <p className="text-[11px] text-slate-500">{t('ku mugenzi', 'per passenger')}</p>
          </div>
          <button
            onClick={onBook}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
          >
            {t('Saba', 'Book')} →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:px-5">
        <span className="font-medium text-slate-900 dark:text-white">{trip.company.name}</span>
        <span className="capitalize">{trip.bus_type}</span>
        {trip.plate_number && <span>· {trip.plate_number}</span>}
        <span className={`ml-auto font-semibold ${seatsLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {trip.seats_available} {t('imyanya isigaye', trip.seats_available === 1 ? 'seat left' : 'seats left')}
        </span>
      </div>
    </li>
  );
}

/* ================================================================== */
/*  Bookings panel                                                     */
/* ================================================================== */

function BookingsPanel({ bookings, loading, onShowTicket, onRefresh, onSearch, t }: any) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Ticket />
        </div>
        <p className="mt-4 font-semibold text-slate-900 dark:text-white">
          {t('Nta bileti ufite', 'No tickets yet')}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {t('Saba bileti yawe ya mbere.', 'Book your first ticket.')}
        </p>
        <button
          onClick={onSearch}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          {t('Shakisha ingendo', 'Search trips')}
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b: any) => (
        <BookingRow
          key={b.id}
          booking={b}
          onShow={() => onShowTicket(b.id)}
          onRefresh={onRefresh}
          t={t}
        />
      ))}
    </ul>
  );
}

function BookingRow({ booking: b, onShow, onRefresh, t }: any) {
  const departure = new Date(b.departure_dt);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <p className="text-[9px] font-bold uppercase text-slate-400">
          {departure.toLocaleString(undefined, { month: 'short' })}
        </p>
        <p className="text-base font-bold text-slate-900 dark:text-white">{departure.getDate()}</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {b.origin_city} → {b.destination_city}
        </p>
        <p className="text-[11px] text-slate-500">
          {b.company_name} · {departure.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
          {b.seat_number ? ` · ${t('umwanya', 'seat')} ${b.seat_number}` : ''}
        </p>
      </div>
      <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {b.reference}
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusStyle(b.status)}`}>
        {b.status}
      </span>
      {b.ticket_status && (
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusStyle(b.ticket_status)}`}>
          {t('bileti', 'ticket')}: {b.ticket_status}
        </span>
      )}
      <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white">
        {b.amount_rwf.toLocaleString()} RWF
      </span>
      <div className="flex gap-2">
        {b.status === 'pending' && (
          <button
            onClick={async () => {
              try { await api.intercityPayDemo(b.id); onRefresh(); } catch {}
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            {t('Ishyura (demo)', 'Pay (demo)')}
          </button>
        )}
        {b.status === 'paid' && (
          <button
            onClick={onShow}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {t('Reba QR', 'Show QR')}
          </button>
        )}
      </div>
    </li>
  );
}

function statusStyle(s: string) {
  switch (s) {
    case 'paid':
    case 'issued':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    case 'used':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
    case 'cancelled':
    case 'expired':
    case 'refunded':
      return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800';
  }
}

/* ================================================================== */
/*  Book modal                                                         */
/* ================================================================== */

function BookModal({ trip, onClose, onCreated }: any) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [idNo, setIdNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const departure = new Date(trip.departure_dt);
  const arrival = new Date(trip.arrival_dt);

  async function submit() {
    if (!name.trim()) { setErr(t('Amazina arakenewe.', 'Name is required.')); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.intercityCreateBooking({
        tripId: trip.trip_id,
        passengerName: name.trim(),
        passengerPhone: phone.trim() || undefined,
        passengerEmail: email.trim() || undefined,
        passengerIdNo: idNo.trim() || undefined
      });
      await api.intercityPayDemo(r.booking.id);
      onCreated();
    } catch (e: any) {
      setErr(e.message || 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Saba bileti', 'Book ticket')}
      wide
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
          >
            {t('Reka', 'Cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {busy ? t('Turakora…', 'Processing…') : `${t('Ishyura', 'Pay')} ${trip.price_rwf.toLocaleString()} RWF`}
          </button>
        </>
      }
    >
      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-sky-950 p-5 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          {trip.company.name} · {trip.bus_type}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {departure.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {trip.route.origin_city} · {trip.route.origin_terminal}
            </p>
          </div>
          <div className="flex flex-1 items-center gap-2 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <div className="relative h-px flex-1 bg-slate-700" />
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">
              {arrival.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {trip.route.destination_city} · {trip.route.destination_terminal}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
          <span>{departure.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span>· {trip.route.distance_km} km</span>
          <span>· {Math.floor(trip.route.duration_min / 60)}h {trip.route.duration_min % 60}m</span>
          <span>· {trip.seats_available} {t('imyanya isigaye', 'seats left')}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <IInput label={t('Amazina y’umugenzi', 'Passenger name')} value={name} onChange={setName} required />
        <IInput label={t('Telefone', 'Phone')} value={phone} onChange={setPhone} placeholder="+250 7XX XXX XXX" />
        <IInput label={t('Email', 'Email')} value={email} onChange={setEmail} type="email" />
        <IInput label={t('Indangamuntu (ID)', 'National ID (optional)')} value={idNo} onChange={setIdNo} />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        {t(
          'Ishyura ry’ikigereranyo. Bileti yawe izaba ifite QR code ishobora gucapwa.',
          'Demonstration payment only. Your ticket will have a printable QR code.'
        )}
      </p>
    </Modal>
  );
}

function IInput({ label, value, onChange, type = 'text', placeholder, required }: any) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

/* ================================================================== */
/*  Ticket modal                                                       */
/* ================================================================== */

function TicketModal({ bookingId, onClose, onPrint }: any) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [ticket, setTicket] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.intercityTicket(bookingId).then((r) => setTicket(r.ticket)).catch((e) => setErr(e.message));
  }, [bookingId]);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('Bileti yawe', 'Your ticket')}
      wide
      footer={
        <>
          {ticket && (
            <button
              onClick={() => onPrint(ticket)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800"
            >
              🖨️ {t('Capisha', 'Print')}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            {t('Funga', 'Close')}
          </button>
        </>
      }
    >
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!ticket && !err && <p className="text-sm text-slate-500">{t('Turashakisha…', 'Loading…')}</p>}

      {ticket && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
            <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
              {ticket.qr_data_url && (
                <img
                  src={ticket.qr_data_url}
                  alt="QR code"
                  className="mx-auto h-[240px] w-[240px] rounded-xl bg-white p-2"
                />
              )}
              <div className="space-y-3">
                <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statusChip(ticket.status)}`}>
                  {ticket.status}
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {t('Urugendo', 'Journey')}
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
                    {ticket.origin_city} → {ticket.destination_city}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoLine label={t('Itariki', 'Departure')} value={new Date(ticket.departure_dt).toLocaleString()} />
                  <InfoLine label={t('Kode', 'Reference')} value={ticket.reference} mono />
                  <InfoLine label={t('Umwanya', 'Seat')} value={`#${ticket.seat_number ?? '—'}`} />
                  <InfoLine label={t('Igiciro', 'Fare')} value={`${ticket.amount_rwf.toLocaleString()} RWF`} />
                  <InfoLine label={t('Sosiyete', 'Company')} value={ticket.company_name} />
                  <InfoLine label={t('Imodoka', 'Plate')} value={ticket.plate_number || '—'} mono />
                </div>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {t(
                    'Erekana iyi QR ku mudereva. Ikimenyetso kimaze gusomwa rimwe, ntikizongera gukoreshwa.',
                    'Show this QR to the driver. Once scanned, this ticket cannot be used again.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InfoLine({ label, value, mono }: any) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-0.5 font-medium text-slate-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function statusChip(s: string) {
  switch (s) {
    case 'issued':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'used':
      return 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100';
    case 'expired':
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    default:
      return 'bg-slate-100 dark:bg-slate-800';
  }
}

/* ================================================================== */
/*  Printable ticket                                                   */
/* ================================================================== */

function PrintableTicket({ data: tk }: { data: any }) {
  const dep = new Date(tk.departure_dt);
  const depDate = dep.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const depTime = dep.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="rv-print-area">
      <div style={{ maxWidth: '760px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: '#0f172a' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0f172a', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: '22px'
            }}>R</div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>RouteView</div>
              <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '2px' }}>
                Interprovincial E-Ticket
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Reference</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>{tk.reference}</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', fontFamily: 'ui-monospace, monospace' }}>{tk.code}</div>
          </div>
        </div>

        {/* Journey strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>From</div>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginTop: '2px' }}>{tk.origin_city}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{tk.origin_terminal}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9' }} />
            <div style={{ width: '60px', height: '2px', background: '#cbd5e1' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em' }}>To</div>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', marginTop: '2px' }}>{tk.destination_city}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{tk.destination_terminal}</div>
          </div>
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '24px', marginTop: '28px' }}>
          <div>
            <PrintRow label="Passenger" value={tk.passenger_name} bold />
            {tk.passenger_phone && <PrintRow label="Phone" value={tk.passenger_phone} />}
            <PrintRow label="Departure" value={`${depDate} · ${depTime}`} />
            <PrintRow label="Seat" value={`#${tk.seat_number ?? '—'}`} />
            <PrintRow label="Fare" value={`${tk.amount_rwf.toLocaleString()} RWF`} />
            <PrintRow label="Operator" value={tk.company_name} />
            <PrintRow label="Plate" value={tk.plate_number || '—'} mono />
            {tk.driver_name && <PrintRow label="Driver" value={tk.driver_name} />}
          </div>
          <div style={{ textAlign: 'right' }}>
            {tk.qr_data_url && (
              <img src={tk.qr_data_url} alt="QR" style={{ width: '200px', height: '200px', display: 'block', marginLeft: 'auto' }} />
            )}
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', fontFamily: 'ui-monospace, monospace' }}>{tk.code}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '28px', paddingTop: '14px', borderTop: '1px dashed #94a3b8', fontSize: '10.5px', color: '#475569', lineHeight: 1.55 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>Instructions</p>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li>Show this ticket at the terminal 20 minutes before departure.</li>
            <li>The driver or operator will scan the QR code once. After scanning, this ticket is marked as used and cannot be reused.</li>
            <li>Bring a valid ID matching the passenger name.</li>
            <li>This is a RouteView demonstration ticket. Not valid for actual travel.</li>
          </ul>
          <p style={{ marginTop: '10px', fontSize: '9.5px', color: '#94a3b8' }}>
            RouteView · routeview.rw · Printed {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function PrintRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: '110px' }}>
        {label}
      </span>
      <span style={{
        fontSize: bold ? '14px' : '13px',
        fontWeight: bold ? 700 : 500,
        color: '#0f172a',
        fontFamily: mono ? 'ui-monospace, monospace' : 'inherit'
      }}>{value}</span>
    </div>
  );
}

/* ================================================================== */
/*  Auth screen                                                        */
/* ================================================================== */

function AuthScreen() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="mx-auto max-w-6xl py-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 lg:grid lg:grid-cols-2">
        {/* Marketing panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 p-10 text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>
          <div className="relative flex flex-col">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg">
                <Bus />
              </span>
              <span className="text-xl font-bold tracking-tight">
                Route<span className="text-sky-400">View</span>
              </span>
            </div>
            <h2 className="mt-14 text-3xl font-bold leading-tight tracking-tight">
              {t('Bileti z’ingendo', 'Interprovincial')}<br />
              <span className="bg-gradient-to-r from-sky-300 to-emerald-300 bg-clip-text text-transparent">
                {t('mu Rwanda hose.', 'tickets, digital.')}
              </span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
              {t(
                'Saba bileti kuva aho uri ujya aho ushaka mu ntara zose z’u Rwanda.',
                'Book tickets from anywhere to anywhere in every province.'
              )}
            </p>
            <ul className="mt-10 space-y-4">
              <Perk
                icon={<Ticket />}
                title={t('Bileti za digitale', 'Digital tickets')}
                body={t('QR code imwe, ikoreshwa rimwe gusa.', 'One QR, one scan.')}
              />
              <Perk
                icon={<Bus />}
                title={t('Ingendo zose', 'All provinces')}
                body={t('Volcano, Ritco, KBS, Trinity, Alpha na Omega.', 'Volcano, Ritco, KBS, Trinity, Alpha and Omega.')}
              />
              <Perk
                icon={<Shield />}
                title={t('Capisha', 'Printable')}
                body={t('Capisha bileti yawe cyangwa uyishyire kuri telefone.', 'Print your ticket or show it on your phone.')}
              />
            </ul>
            <div className="mt-auto pt-12">
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300 backdrop-blur">
                <span className="font-semibold text-white">{t('Urugero:', 'Demo:')}</span>{' '}
                <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">passenger@routeview.rw</code>{' '}
                / <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono">Password123!</code>
              </p>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500">
              <Bus />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Route<span className="text-sky-600 dark:text-sky-400">View</span>
            </span>
          </div>

          <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
            <TabButton active={mode === 'login'} onClick={() => setMode('login')}>
              {t('Injira', 'Sign in')}
            </TabButton>
            <TabButton active={mode === 'register'} onClick={() => setMode('register')}>
              {t('Fungura konti', 'Create account')}
            </TabButton>
          </div>

          <div className="mt-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {mode === 'login'
                ? t('Murakaza neza!', 'Welcome back!')
                : t('Tangira ubu.', 'Get started.')}
            </h1>
          </div>

          <div className="mt-8">
            {mode === 'login' ? <LoginForm /> : <RegisterForm />}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState<any>({});

  const emailError = touched.email && !isValidEmail(email)
    ? t('Email itariyo.', 'Enter a valid email.')
    : null;
  const passwordError = touched.password && password.length < 6
    ? t('Ijambobanga rigufi.', 'Password is too short.')
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValidEmail(email) || password.length < 6) return;
    setBusy(true); setErr(null);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      const msg = String(e?.message || '');
      setErr(
        msg.includes('invalid_credentials')
          ? t('Email cyangwa ijambobanga sibyo.', 'Incorrect email or password.')
          : msg.includes('429')
          ? t('Ugerageza kenshi.', 'Too many attempts.')
          : t('Habaye ikibazo.', 'Something went wrong.')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Banner>{err}</Banner>}
      <Field2
        label={t('Email', 'Email')}
        type="email"
        value={email}
        onChange={setEmail}
        onBlur={() => setTouched((x: any) => ({ ...x, email: true }))}
        error={emailError}
        placeholder="you@example.com"
      />
      <Field2
        label={t('Ijambobanga', 'Password')}
        type={showPwd ? 'text' : 'password'}
        value={password}
        onChange={setPassword}
        onBlur={() => setTouched((x: any) => ({ ...x, password: true }))}
        error={passwordError}
        placeholder="••••••••"
        trailing={
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          >
            {showPwd ? t('Hisha', 'Hide') : t('Erekana', 'Show')}
          </button>
        }
      />
      <Submit busy={busy} disabled={false}>
        {busy ? t('Twinjira…', 'Signing in…') : t('Injira', 'Sign in')}
      </Submit>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const { lang, setLang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [prefLang, setPrefLang] = useState<'rw' | 'en'>(lang);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [touched, setTouched] = useState<any>({});

  const strength = useMemo(() => passwordStrength(password), [password]);
  const canSubmit =
    fullName.trim().length >= 2 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    confirm === password &&
    accept;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, confirm: true });
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        preferred_lang: prefLang
      });
      if (prefLang !== lang) setLang(prefLang);
    } catch (e: any) {
      const msg = String(e?.message || '');
      setErr(
        msg.includes('email_taken')
          ? t('Iyi email isanzwe.', 'Email already registered.')
          : t('Habaye ikibazo.', 'Something went wrong.')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Banner>{err}</Banner>}
      <Field2
        label={t('Amazina yombi', 'Full name')}
        type="text"
        value={fullName}
        onChange={setFullName}
        error={touched.fullName && fullName.trim().length < 2 ? t('Andika amazina.', 'Enter your name.') : null}
      />
      <Field2
        label={t('Email', 'Email')}
        type="email"
        value={email}
        onChange={setEmail}
        error={touched.email && !isValidEmail(email) ? t('Email itariyo.', 'Invalid email.') : null}
      />
      <Field2
        label={t('Telefone (bidategetswe)', 'Phone (optional)')}
        type="tel"
        value={phone}
        onChange={setPhone}
      />
      <Field2
        label={t('Ijambobanga', 'Password')}
        type="password"
        value={password}
        onChange={setPassword}
        error={touched.password && password.length < 8 ? t('Nibura inyuguti 8.', 'At least 8 characters.') : null}
      />
      {password.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${['bg-red-500','bg-amber-500','bg-yellow-500','bg-emerald-500'][strength.score]} ${['w-1/4','w-2/4','w-3/4','w-full'][strength.score]}`}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {lang === 'rw' ? strength.label_rw : strength.label_en}
          </span>
        </div>
      )}
      <Field2
        label={t('Emeza ijambobanga', 'Confirm password')}
        type="password"
        value={confirm}
        onChange={setConfirm}
        error={touched.confirm && confirm !== password ? t('Ntahura.', 'Passwords do not match.') : null}
      />
      <div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {t('Ururimi', 'Language')}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setPrefLang('rw')}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              prefLang === 'rw'
                ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            Kinyarwanda
          </button>
          <button
            type="button"
            onClick={() => setPrefLang('en')}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm ${
              prefLang === 'en'
                ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            English
          </button>
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-sky-600"
        />
        <span>{t('Nemera amabwiriza n’ibanga.', 'I agree to the terms and privacy policy.')}</span>
      </label>
      <Submit busy={busy} disabled={!canSubmit}>
        {busy ? t('Turakora…', 'Creating…') : t('Fungura konti', 'Create account')}
      </Submit>
    </form>
  );
}

function Field2({ label, type, value, onChange, onBlur, error, placeholder, trailing }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <div className={`mt-1.5 flex items-center rounded-xl border bg-white transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:bg-slate-950 ${
        error ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'
      }`}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
        />
        {trailing && <span className="pr-3">{trailing}</span>}
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </label>
  );
}

function Submit({ busy, disabled, children }: any) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900"
    >
      {busy && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900" />
      )}
      {children}
    </button>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/* ================================================================== */
/*  Shared small components + helpers                                  */
/* ================================================================== */

function TabButton({ active, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${
        active
          ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function StepTab({ active, onClick, children, disabled }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-40 ${
        active
          ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Perk({ icon, title, body }: any) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{body}</p>
      </div>
    </li>
  );
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function passwordStrength(p: string) {
  let score = 0;
  if (p.length >= 8) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  const L = [
    { rw: 'Nkeya cyane', en: 'Very weak' },
    { rw: 'Nkeya', en: 'Weak' },
    { rw: 'Iri hagati', en: 'Fair' },
    { rw: 'Niza', en: 'Good' },
    { rw: 'Niza cyane', en: 'Strong' }
  ][Math.min(score, 4)];
  return { score: Math.min(score, 4), label_rw: L.rw, label_en: L.en };
}

function Bus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Z" />
      <path d="M4 12h16M8 20v-2M16 20v-2" />
      <circle cx="8" cy="16" r="1" fill="white" />
      <circle cx="16" cy="16" r="1" fill="white" />
    </svg>
  );
}

function Ticket() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 6v2M13 10v2M13 14v2M13 18v0" />
    </svg>
  );
}

function Shield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}