'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const PlacesMap = dynamic(() => import('@/components/PlacesMap'), { ssr: false });

type Msg = { role: 'user' | 'assistant'; content: string };
type Place = any;
type Coords = { lat: number; lng: number; accuracy?: number };

export default function PlacesPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [geoState, setGeoState] = useState<'idle' | 'pending' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [autoResuming, setAutoResuming] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const watchRef = useRef<number | null>(null);

  // Refs so the geolocation callback can see the latest values without stale closures
  const needsLocationRef = useRef(false);
  const lastUserMessageRef = useRef<string | null>(null);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => { needsLocationRef.current = needsLocation; }, [needsLocation]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, busy, autoResuming]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  /**
   * Ask for the browser location and, once received, automatically resume
   * the conversation by re-sending the previous user message — this time
   * with the coordinates attached. No extra typing required.
   */
  function requestLocation() {
    if (!('geolocation' in navigator)) {
      setGeoState('unsupported');
      setGeoError(t('Mudasobwa ntishyigikira location.', 'Geolocation not supported.'));
      return;
    }
    setGeoState('pending');
    setGeoError(null);
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);

    let hasAutoResumed = false;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: Coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setUserLocation(loc);
        setGeoState('granted');

        // Auto-resume if the assistant was waiting for location — fires only once
        if (!hasAutoResumed && needsLocationRef.current && lastUserMessageRef.current) {
          hasAutoResumed = true;
          setNeedsLocation(false);
          needsLocationRef.current = false;
          setAutoResuming(true);
          // Small delay so the map can drop the user marker before the AI answers
          setTimeout(() => {
            send(lastUserMessageRef.current!, loc);
          }, 350);
        }
      },
      (err) => {
        setGeoState('denied');
        setGeoError(err.message || 'Location permission denied.');
        if (watchRef.current != null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  /**
   * Send a message. Optionally override the location used for this request
   * (required when we're resuming right after the geolocation callback fires,
   * because React state hasn't updated yet).
   */
  async function send(text?: string, locationOverride?: Coords | null) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    setAutoResuming(false);

    lastUserMessageRef.current = message;
    const nextHistory: Msg[] = [...messagesRef.current, { role: 'user', content: message }];
    setMessages(nextHistory);

    try {
      const r = await api.placesChat({
        message,
        lang,
        history: messagesRef.current.slice(-6),
        userLocation:
          locationOverride !== undefined ? locationOverride : userLocation
      });

      setMessages((m) => [...m, { role: 'assistant', content: r.reply }]);

      if (r.action === 'request_location') {
        setNeedsLocation(true);
        needsLocationRef.current = true;
      } else {
        setNeedsLocation(false);
        needsLocationRef.current = false;
      }

      if (r.action === 'show_places' && Array.isArray(r.places)) {
        setPlaces(r.places);
        setSelectedPlace(r.places[0] || null);
        setSource(r.source || null);
      }
    } catch (e: any) {
      const detail = e?.message || 'unknown_error';
      console.error('[places] chat failed:', detail, e);
      setMessages((m) => [...m, {
        role: 'assistant',
        content: t(
          `Habaye ikibazo (${detail}). Ongera ugerageze.`,
          `Something went wrong (${detail}). Please try again.`
        )
      }]);
    } finally {
      setBusy(false);
      setAutoResuming(false);
    }
  }

  const suggestions = useMemo(() => (
    lang === 'rw'
      ? [
          'Nshaka aho ndya hafi yanjye',
          'Hafi yanjye hari resitora?',
          'Nshaka kugura imiti',
          'Aho nakura amafaranga (ATM)',
          'Supermarket iri hafi'
        ]
      : [
          'Where can I eat near me?',
          'Any good restaurants nearby?',
          'I need a pharmacy',
          'Where is the nearest ATM?',
          'Find a supermarket close by'
        ]
  ), [lang]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Shakisha ahantu', 'Find places')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Baza umufasha mu magambo yawe. Ahawe location yawe, aguha ahantu hafi nawe n’uburyo bwo kuhagera.',
              'Ask the assistant in your own words. Share your location and get nearby places with transport options.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          <button
            onClick={requestLocation}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              geoState === 'granted'
                ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                : geoState === 'pending'
                ? 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            {geoState === 'granted'
              ? t('Aho ndi ✓', 'Location on')
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

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        <aside className="flex h-[calc(100vh-260px)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('Umufasha w’ahantu', 'Place assistant')}
            </p>
            <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              AI
            </span>
          </div>

          <div ref={chatRef} className="flex-1 space-y-3 overflow-auto p-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <p className="font-medium text-slate-900 dark:text-white">
                  {t('Murakaza neza 👋', 'Welcome 👋')}
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {t(
                    'Mbaza ikintu ushaka (ibiryo, imiti, banki…) hanyuma unyereke aho uri. Nzagufasha kubona ahantu hafi yawe n’uburyo bwo kuhagera.',
                    'Ask me what you are looking for (food, pharmacy, bank…) then share your location. I will find nearby places and how to reach them.'
                  )}
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-8 bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'mr-8 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                }`}
              >
                {m.content}
              </div>
            ))}

            {/* Thinking indicator — also shows during auto-resume */}
            {(busy || autoResuming) && (
              <div className="mr-8 flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '300ms' }} />
                </span>
                {autoResuming
                  ? t('Ndashakisha ahantu hafi yawe…', 'Finding places near you…')
                  : t('Aratekereza…', 'Thinking…')}
              </div>
            )}

            {/* Share-location call-to-action */}
            {needsLocation && geoState !== 'pending' && !busy && !autoResuming && (
              <button
                onClick={requestLocation}
                className="w-full rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:border-sky-400 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
              >
                📍 {t('Kanda hano usangize aho uri', 'Tap here to share your location')}
              </button>
            )}

            {needsLocation && geoState === 'pending' && (
              <div className="w-full rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-center text-sm text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                {t('Turashaka aho uri…', 'Getting your location…')}
              </div>
            )}

            {/* Place cards */}
            {places.length > 0 && !busy && !autoResuming && (
              <div className="space-y-2 pt-1">
                {places.map((p) => (
                  <PlaceCard
                    key={p.id}
                    place={p}
                    lang={lang}
                    selected={selectedPlace?.id === p.id}
                    onSelect={() => setSelectedPlace(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
              {suggestions.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={autoResuming}
                placeholder={
                  autoResuming
                    ? t('Turashakisha…', 'Finding places…')
                    : geoState === 'granted'
                    ? t('Andika ikintu ushaka…', 'Type what you need…')
                    : t('Andika… hanyuma ukande "Aho ndi"', 'Type… then tap "My location"')
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || busy || autoResuming}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-600/20 transition hover:from-sky-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy || autoResuming ? '…' : t('Ohereza', 'Send')}
              </button>
            </div>
            {source && (
              <p className="mt-1.5 text-[10px] text-slate-400">
                {source === 'osm'
                  ? t('Amakuru y’ahantu ava kuri OpenStreetMap.', 'Place data from OpenStreetMap.')
                  : t('Amakuru y’ahantu ni urugero rwa demonstration.', 'Place data is a demonstration dataset.')}
              </p>
            )}
          </div>
        </aside>

        <div className="h-[calc(100vh-260px)] min-h-[560px]">
          <PlacesMap
            userLocation={userLocation}
            places={places}
            selectedPlace={selectedPlace}
            onSelectPlace={(p) => setSelectedPlace(p)}
            mapStyle={mapStyle}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Place card ---------------- */

function PlaceCard({
  place, lang, selected, onSelect
}: { place: any; lang: 'rw' | 'en'; selected: boolean; onSelect: () => void }) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${
        selected
          ? 'border-sky-400 ring-2 ring-sky-200 dark:border-sky-500 dark:ring-sky-900/40'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      <button
        onClick={onSelect}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 text-base dark:from-sky-950 dark:to-emerald-950">
          {categoryEmoji(place.category)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {place.name}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {place.distance_m != null ? `${formatDistance(place.distance_m)} · ` : ''}
            {place.walking_min != null ? `${place.walking_min} ${t('min guhamba', 'min walk')}` : place.category}
          </p>
        </div>
        <svg
          className={`mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {(selected || expanded) && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="grid gap-2 sm:grid-cols-2">
            {place.moto && (
              <TransportTile
                icon="🛵"
                label={t('Moto', 'Moto')}
                primary={`${place.moto.fare_rwf.toLocaleString()} RWF`}
                secondary={`~${place.moto.duration_min} ${t('min', 'min')}`}
                tone="amber"
              />
            )}
            {place.bus && (
              <TransportTile
                icon="🚌"
                label={`${t('Bisi', 'Bus')} ${place.bus.route_code}`}
                primary={`${place.bus.fare_rwf.toLocaleString()} RWF`}
                secondary={`~${place.bus.duration_min} ${t('min', 'min')}`}
                tone="emerald"
                extra={
                  place.bus.from_stop && place.bus.to_stop
                    ? `${place.bus.from_stop.name_en} → ${place.bus.to_stop.name_en}`
                    : undefined
                }
              />
            )}
            {!place.bus && place.moto && (
              <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                {t('Nta nzira ya bisi ibonetse.', 'No bus route found for this destination.')}
              </div>
            )}
          </div>

          {place.address && (
            <p className="mt-2 text-[11px] text-slate-500">{place.address}</p>
          )}

          <div className="mt-3 flex gap-2">
            <Link
              href="/plan"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {t('Tegura urugendo', 'Plan journey')}
            </Link>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-center text-xs font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              {t('Fungura navigation', 'Open navigation')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function TransportTile({
  icon, label, primary, secondary, tone, extra
}: {
  icon: string; label: string; primary: string; secondary: string;
  tone: 'amber' | 'emerald'; extra?: string;
}) {
  const border = tone === 'amber'
    ? 'border-amber-200 dark:border-amber-900/60'
    : 'border-emerald-200 dark:border-emerald-900/60';
  const bg = tone === 'amber'
    ? 'bg-amber-50 dark:bg-amber-950/30'
    : 'bg-emerald-50 dark:bg-emerald-950/30';
  const fg = tone === 'amber'
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-emerald-700 dark:text-emerald-300';
  return (
    <div className={`rounded-lg border ${border} ${bg} px-2.5 py-2`}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${fg}`}>{label}</span>
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{primary}</p>
      <p className="text-[10px] text-slate-500">{secondary}</p>
      {extra && <p className="mt-0.5 truncate text-[10px] text-slate-500">{extra}</p>}
    </div>
  );
}

function categoryEmoji(cat: string): string {
  const m: Record<string, string> = {
    restaurant: '🍽️', cafe: '☕', fast_food: '🍔', bar: '🍺',
    supermarket: '🛒', market: '🏪', pharmacy: '💊', hospital: '🏥',
    bank: '🏦', atm: '🏧', fuel: '⛽', hotel: '🏨', school: '🎓',
    place_of_worship: '⛪', place: '📍'
  };
  return m[cat] || '📍';
}

function formatDistance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}