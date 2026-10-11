'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false });

type MapStyle = 'streets' | 'satellite';

export default function MapPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routeOverlays, setRouteOverlays] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [routeFilter, setRouteFilter] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [followUser, setFollowUser] = useState(false);
  const [geoState, setGeoState] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const [arrival, setArrival] = useState<any | null>(null);
  const [arrivalBusy, setArrivalBusy] = useState(false);
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);
  const watchRef = useRef<number | null>(null);

  /* ---- Load routes + their stops once ---- */
  useEffect(() => {
    (async () => {
      try {
        const { routes } = await api.listRoutes();
        const detailed = await Promise.all(
          routes.map((r: any) =>
            api.getRoute(r.id)
              .then((d: any) => ({
                id: r.id,
                code: r.code,
                color: r.color_hex,
                stops: d.stops.map((s: any) => ({
                  id: s.id,
                  code: s.code,
                  name_en: s.name_en,
                  name_rw: s.name_rw,
                  lat: Number(s.lat),
                  lng: Number(s.lng)
                }))
              }))
              .catch(() => null)
          )
        );
        setRouteOverlays(detailed.filter(Boolean));
      } catch { /* ignore */ }
    })();
  }, []);

  /* ---- Poll vehicles every 3s ---- */
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.vehicles();
        if (cancelled) return;
        setVehicles(r.vehicles);
        setLastUpdate(new Date());
        setVehiclesLoaded(true);
        setSelected((cur: any) =>
          cur ? r.vehicles.find((v: any) => v.vehicle_id === cur.vehicle_id) || cur : null
        );
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* ---- Cleanup geolocation on unmount ---- */
  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function toggleUserLocation() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      setUserLocation(null);
      setFollowUser(false);
      setGeoState('idle');
      setGeoError(null);
      return;
    }
    if (!('geolocation' in navigator)) {
      setGeoState('unsupported');
      setGeoError(t('Mudasobwa ntishyigikira location.', 'Your browser does not support geolocation.'));
      return;
    }
    setGeoState('pending');
    setGeoError(null);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGeoState('granted');
        setFollowUser(true);
      },
      (err) => {
        setGeoState('denied');
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? t('Wanzeho uruhushya rwo kumenya aho uri.', 'You denied location permission.')
            : err.message
        );
        if (watchRef.current != null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let list = vehicles;
    if (routeFilter !== 'all') list = list.filter((v) => v.route_id === routeFilter);
    if (needle) {
      list = list.filter((v) =>
        `${v.plate} ${v.label} ${v.route_code} ${v.next_stop?.name_en || ''} ${v.destination?.name_en || ''}`
          .toLowerCase().includes(needle)
      );
    }
    return list;
  }, [vehicles, routeFilter, query]);

  const visibleOverlays = useMemo(() => {
    if (routeFilter === 'all') return routeOverlays;
    return routeOverlays.filter((r) => r.id === routeFilter);
  }, [routeOverlays, routeFilter]);

  const selectedOverlay = useMemo(() => {
    if (!selected?.route_id) return null;
    const found = routeOverlays.find((r) => r.id === selected.route_id);
    return found ? { ...found, color: selected.color_hex } : null;
  }, [selected, routeOverlays]);

  useEffect(() => {
    if (!selected?.vehicle_id || !selected?.next_stop?.id) {
      setArrival(null);
      return;
    }
    setArrivalBusy(true);
    api.arrival(selected.vehicle_id, selected.next_stop.id)
      .then(setArrival)
      .catch(() => setArrival(null))
      .finally(() => setArrivalBusy(false));
  }, [selected?.vehicle_id, selected?.next_stop?.id]);

  return (
    <div className="space-y-4">
      {/* ---------------- Header ---------------- */}
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Ikarita y’ibihe nyacyo', 'Live map')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {lastUpdate ? `${t('Byavuguruwe', 'Updated')} ${lastUpdate.toLocaleTimeString()} · ` : ''}
            <span className={filtered.length > 0 ? 'font-medium text-emerald-600 dark:text-emerald-400' : ''}>
              {filtered.length} {t('bisi ku ikarita', filtered.length === 1 ? 'bus on map' : 'buses on map')}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Map style toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setMapStyle('streets')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                mapStyle === 'streets'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t('Ikarita', 'Streets')}
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                mapStyle === 'satellite'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {t('Satellite', 'Satellite')}
            </button>
          </div>

          {/* My location toggle */}
          <button
            onClick={toggleUserLocation}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              geoState === 'granted'
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                : geoState === 'pending'
                ? 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            {geoState === 'granted'
              ? t('Hagarika', 'Stop tracking')
              : geoState === 'pending'
              ? t('Turashaka…', 'Locating…')
              : t('Aho ndi', 'My location')}
          </button>
        </div>
      </header>

      {geoError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {geoError}
        </div>
      )}

      {/* ---------------- Filters ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Shakisha bisi, ingendo, ahantu…', 'Search buses, routes, stops…')}
          className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        />
        <select
          value={routeFilter === 'all' ? 'all' : String(routeFilter)}
          onChange={(e) => setRouteFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">{t('Ingendo zose', 'All routes')}</option>
          {routeOverlays.map((r) => (
            <option key={r.id} value={r.id}>{r.code}</option>
          ))}
        </select>
      </div>

      {/* ---------------- Layout ---------------- */}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-3">
          {/* Selected vehicle card */}
          {selected && (
            <div
              className="rounded-2xl border-2 bg-white p-4 shadow-sm dark:bg-slate-900"
              style={{ borderColor: selected.color_hex }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 min-w-[38px] items-center justify-center rounded-lg px-2 text-xs font-bold text-white"
                      style={{ backgroundColor: selected.color_hex }}
                    >
                      {selected.route_code}
                    </span>
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {selected.plate}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{selected.label}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* Occupancy */}
              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    {t('Abagenzi', 'Passengers')}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selected.passengers} / {selected.capacity}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((selected.passengers / selected.capacity) * 100)}%`,
                      backgroundColor:
                        selected.passengers / selected.capacity > 0.85 ? '#f59e0b'
                        : selected.passengers / selected.capacity > 0.6 ? '#0ea5e9'
                        : '#10b981'
                    }}
                  />
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-xs">
                {selected.prev_stop && <Row label={t('Kuva', 'From')} value={selected.prev_stop.name_en} muted />}
                {selected.next_stop && <Row label={t('Akurikira', 'Next stop')} value={selected.next_stop.name_en} />}
                {selected.destination && <Row label={t('Aho ijya', 'Destination')} value={selected.destination.name_en} />}
                {selected.speed_kmh != null && <Row label={t('Umuvuduko', 'Speed')} value={`${Math.round(selected.speed_kmh)} km/h`} />}
                <Row
                  label={t('Akamaro', 'Feed')}
                  value={selected.simulated ? t('Ikigereranyo', 'Simulated') : 'GPS'}
                  tone={selected.simulated ? 'amber' : 'emerald'}
                />
              </dl>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {t('Igihe kizagera', 'Arrival estimate')}
                </p>
                {arrivalBusy && <p className="mt-1 text-xs text-slate-400">{t('Bibarwa…', 'Predicting…')}</p>}
                {!arrivalBusy && arrival && (
                  <>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                      {Math.max(1, Math.round(arrival.seconds / 60))}
                      <span className="ml-1 text-sm font-normal text-slate-500">{t('min', 'min')}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {arrival.source === 'model'
                        ? `${t('Moderi yacu', 'Our ML model')} v${arrival.model_version}`
                        : t('Ibarwa ry’igihe gito', 'Physics fallback')}
                    </p>
                  </>
                )}
                {!arrivalBusy && !arrival && <p className="mt-1 text-xs text-slate-400">{t('Nta makuru', 'No data')}</p>}
              </div>

              <Link
                href={`/routes/${selected.route_id}`}
                className="mt-4 block w-full rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {t('Reba iyi nzira', 'View this route')} →
              </Link>
            </div>
          )}

          {/* Vehicle list */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {t('Bisi kuri ikarita', 'Buses on map')}
              </p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {filtered.length}
              </span>
            </div>

            {!vehiclesLoaded && (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            )}

            {vehiclesLoaded && filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                <p className="font-medium">{t('Nta bisi ibonetse.', 'No buses match.')}</p>
                <p className="mt-1">{t('Bisi zigenda gutangira kugaragara.', 'Buses will appear shortly.')}</p>
              </div>
            )}

            <ul className="max-h-[420px] divide-y divide-slate-100 overflow-auto dark:divide-slate-800">
              {filtered.map((v) => (
                <li key={v.vehicle_id}>
                  <button
                    onClick={() => setSelected(v)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      selected?.vehicle_id === v.vehicle_id
                        ? 'bg-slate-100 dark:bg-slate-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span
                      className="flex h-7 min-w-[38px] items-center justify-center rounded-lg px-2 text-[10px] font-bold text-white"
                      style={{ backgroundColor: v.color_hex }}
                    >
                      {v.route_code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {v.plate}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {v.next_stop ? `${t('Kuri', 'Next')} ${v.next_stop.name_en}` : v.label}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-[10px]">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {v.passengers}/{v.capacity}
                      </span>
                      <span className={v.simulated ? 'text-amber-500' : 'text-emerald-500'}>
                        {v.simulated ? t('sim', 'sim') : 'GPS'}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="h-[520px] lg:h-[calc(100vh-260px)] lg:min-h-[600px]">
          <LiveMap
            vehicles={filtered}
            routeOverlays={selectedOverlay ? [selectedOverlay] : visibleOverlays}
            selectedVehicleId={selected?.vehicle_id ?? null}
            onSelectVehicle={(v) => setSelected(v)}
            userLocation={userLocation}
            followUser={followUser}
            showAllRoutes
            mapStyle={mapStyle}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small helpers ---------------- */

function Row({
  label,
  value,
  muted,
  tone
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: 'emerald' | 'amber';
}) {
  const color =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : muted ? 'text-slate-500 dark:text-slate-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex-shrink-0 text-[10px] uppercase tracking-widest text-slate-400">
        {label}
      </dt>
      <dd className={`truncate text-right font-medium ${color}`}>{value}</dd>
    </div>
  );
}