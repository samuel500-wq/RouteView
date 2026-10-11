'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import AiRecommendation from '@/components/AiRecommendation';

const JourneyMap = dynamic(() => import('@/components/JourneyMap'), { ssr: false });

type Mode = 'search' | 'ai';
type Stop = { id: number; code: string; name_rw: string; name_en: string; lat: number; lng: number };
type Option = any;

export default function PlanPage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [mode, setMode] = useState<Mode>('search');
  const [stops, setStops] = useState<Stop[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // search mode state
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);

  // ai mode state
  const [aiQuery, setAiQuery] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // shared results
  const [options, setOptions] = useState<Option[] | null>(null);
  const [resolvedFrom, setResolvedFrom] = useState<Stop | null>(null);
  const [resolvedTo, setResolvedTo] = useState<Stop | null>(null);
  const [aiMeta, setAiMeta] = useState<{ note?: string; confidence?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    api.listStops().then((r) => setStops(r.stops)).catch(() => {});
    api.aiStatus().then((r) => setAiConfigured(r.configured)).catch(() => setAiConfigured(false));
  }, []);

  function resetResults() {
    setOptions(null);
    setError(null);
    setAiMeta(null);
    setAiResult(null);
    setResolvedFrom(null);
    setResolvedTo(null);
    setExpandedIdx(null);
  }

  async function runSearch() {
    if (!fromId || !toId) return;
    if (fromId === toId) {
      setError(t('Hitamo ahantu habiri hatandukanye.', 'Pick two different stops.'));
      return;
    }
    setLoading(true); resetResults();
    try {
      const r = await api.plan(fromId, toId);
      setOptions(r.options);
      const f = stops.find((s) => s.id === fromId) || null;
      const dst = stops.find((s) => s.id === toId) || null;
      setResolvedFrom(f);
      setResolvedTo(dst);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAi() {
    if (!aiQuery.trim()) return;
    setAiBusy(true); resetResults();
    try {
      const r = await api.aiPlan({ query: aiQuery.trim(), lang });
      if (!r.ok) {
        const map: Record<string, string> = {
          ai_not_configured: t(
            'Umufasha wa AI ntaboneka ubu. Koresha Search cyangwa ugerageze nyuma.',
            'The AI assistant is not configured. Use Search or try again later.'
          ),
          stops_not_resolved: t(
            'Sinabashije kumenya ahantu wavuze. Gerageza Search ukoreshe amazina y’ahantu.',
            'I could not determine the stops you meant. Try Search and pick from the list.'
          ),
          ai_parse_failed: t(
            'AI ntiyatanze igisubizo cyumvikana. Gerageza ukoreshe Search.',
            'The AI did not return a usable answer. Try Search instead.'
          ),
          invalid_stop_id: t(
            'AI yatanze ahantu hatariho. Gerageza Search.',
            'The AI referenced an unknown stop. Try Search.'
          ),
          same_stop: t('Aho uva n’aho ujya ni hamwe.', 'Origin and destination are the same.')
        };
        setError(map[r.error] || r.error);
        if (r.note) setAiMeta({ note: r.note, confidence: r.confidence });
        return;
      }
      setOptions(r.options);
      setResolvedFrom(r.from_stop);
      setResolvedTo(r.to_stop);
      setAiMeta({ note: r.note, confidence: r.confidence });
      setAiResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAiBusy(false);
    }
  }

  const suggestions = useMemo(
    () =>
      lang === 'rw'
        ? [
            'Nifasha kugera Kimironko nte?',
            'Nshaka kujya Nyabugogo ndi Kicukiro',
            'Ni gute ngera Remera?',
            'Kuva Kimironko ngera Downtown'
          ]
        : [
            'How do I get to Kimironko from Nyabugogo?',
            'I want to go from Kicukiro to Nyabugogo',
            'How do I reach Remera?',
            'From Kimironko to Downtown'
          ],
    [lang]
  );

  return (
    <div className="space-y-8">
      {/* ---------------- Header ---------------- */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
          {t('Itegura ry’urugendo', 'Journey planning')}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {t('Tegura urugendo rwawe', 'Plan your journey')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {t(
            'Shyiramo aho uva n’aho ujya cyangwa baza umufasha wacu mu magambo yawe bwite — RouteView iraguhitira inzira nziza, igihe n’igiciro.',
            'Enter origin and destination, or just describe your trip in your own words — RouteView works out the best routes, times and fares.'
          )}
        </p>
      </header>

      {/* ---------------- Mode tabs + input ---------------- */}
      <div className="mx-auto max-w-3xl">
        <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => { setMode('search'); resetResults(); }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              mode === 'search'
                ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t('Shakisha', 'Search')}
          </button>
          <button
            onClick={() => { setMode('ai'); resetResults(); }}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              mode === 'ai'
                ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {t('Baza AI', 'Ask AI')}
            {aiConfigured === false && (
              <span className="ml-1 text-[10px] font-normal text-slate-400">
                ({t('ntaboneka', 'offline')})
              </span>
            )}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          {mode === 'search' ? (
            <SearchForm
              stops={stops}
              fromId={fromId}
              toId={toId}
              setFromId={setFromId}
              setToId={setToId}
              onSearch={runSearch}
              loading={loading}
              lang={lang}
            />
          ) : (
            <AiForm
              query={aiQuery}
              setQuery={setAiQuery}
              onSubmit={runAi}
              busy={aiBusy}
              aiConfigured={aiConfigured}
              suggestions={suggestions}
              lang={lang}
            />
          )}
        </div>
      </div>

      {/* ---------------- Error / AI note ---------------- */}
      {error && (
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{error}</p>
          {aiMeta?.note && (
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/70">
              AI: {aiMeta.note}
            </p>
          )}
          {mode === 'ai' && (
            <button
              onClick={() => { setMode('search'); resetResults(); }}
              className="mt-3 text-xs font-semibold text-amber-900 underline dark:text-amber-100"
            >
              {t('Koresha Search', 'Use Search instead')}
            </button>
          )}
        </div>
      )}

      {/* ---------------- Loading ---------------- */}
      {(loading || aiBusy) && (
        <div className="mx-auto max-w-3xl">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Results ---------------- */}
      {options && !loading && (
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Summary line */}
          {resolvedFrom && resolvedTo && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                  {t('Urugero', 'Journey')}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {lang === 'rw' ? resolvedFrom.name_rw : resolvedFrom.name_en}
                  <span className="mx-2 text-slate-400">→</span>
                  {lang === 'rw' ? resolvedTo.name_rw : resolvedTo.name_en}
                </p>
              </div>
              {aiMeta?.confidence !== undefined && mode === 'ai' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                  {t('AI', 'AI')} · {Math.round(aiMeta.confidence * 100)}%
                </span>
              )}
            </div>
          )}

          {/* AI recommendation panel — only in AI mode */}
          {mode === 'ai' && aiResult?.recommendation && (
            <AiRecommendation
              recommendation={aiResult.recommendation}
              arrivals={aiResult.live?.next_arrivals || []}
            />
          )}

          {/* Map — uses inline route data from the AI response when available */}
          {resolvedFrom && resolvedTo && (
            <JourneyMap
              options={options}
              fromStop={resolvedFrom}
              toStop={resolvedTo}
              routesMap={mode === 'ai' ? aiResult?.routes_map : undefined}
            />
          )}

          {/* Options */}
          {options.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="font-medium text-slate-900 dark:text-white">
                {t('Nta nzira yabonetse', 'No route found')}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {t(
                  'Gerageza ahantu handi cyangwa reba ingendo zose.',
                  'Try a different pair of stops, or browse the network.'
                )}
              </p>
              <Link
                href="/routes"
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                {t('Reba ingendo', 'Browse routes')}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {options.map((o, i) => (
                <JourneyCard
                  key={i}
                  option={o}
                  stops={stops}
                  lang={lang}
                  expanded={expandedIdx === i}
                  onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
                  index={i}
                  highlighted={mode === 'ai' && aiResult?.recommendation?.best_option_index === i}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search form                                                         */
/* ------------------------------------------------------------------ */

function SearchForm({
  stops, fromId, toId, setFromId, setToId, onSearch, loading, lang
}: any) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const label = (s: Stop) => (lang === 'rw' ? s.name_rw : s.name_en);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t('Aho uva', 'From')} value={fromId} onChange={setFromId} stops={stops} labelFn={label} />
        <Select label={t('Aho ujya', 'To')} value={toId} onChange={setToId} stops={stops} labelFn={label} />
      </div>
      <button
        onClick={onSearch}
        disabled={!fromId || !toId || loading || fromId === toId}
        className="w-full rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
      >
        {loading ? t('Turashakisha…', 'Searching…') : t('Shakisha inzira', 'Find routes')}
      </button>
    </div>
  );
}

function Select({ label, value, onChange, stops, labelFn }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value) || null)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        <option value="">—</option>
        {stops.map((s: Stop) => (
          <option key={s.id} value={s.id}>
            {labelFn(s)} · {s.code}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* AI form                                                             */
/* ------------------------------------------------------------------ */

function AiForm({ query, setQuery, onSubmit, busy, aiConfigured, suggestions, lang }: any) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  if (aiConfigured === false) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
        <p className="font-medium text-slate-900 dark:text-white">
          {t('Umufasha wa AI ntarashyirwaho', 'The AI assistant is not configured yet')}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {t(
            'Shyiramo OPENROUTER_API_KEY muri .env kugira ngo ubashe kubaza mu magambo yawe.',
            'Set OPENROUTER_API_KEY in .env to ask in your own words.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={3}
        placeholder={t(
          'Urugero: Nifasha kugera Kimironko nte?',
          'Example: How do I get to Kimironko from Nyabugogo?'
        )}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s: string) => (
          <button
            key={s}
            onClick={() => setQuery(s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-500 dark:hover:text-sky-400"
          >
            {s}
          </button>
        ))}
      </div>

      <button
        onClick={onSubmit}
        disabled={!query.trim() || busy}
        className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:from-sky-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? t('Umufasha aratekereza…', 'Thinking…') : t('Baza umufasha', 'Ask the assistant')}
      </button>

      <p className="text-center text-[11px] text-slate-400">
        {t(
          'AI isubiza ishingiye gusa ku makuru y’urubuga — ntabwo aduhisha ingendo cyangwa ibiciro.',
          'The assistant answers from real network data — it never invents routes or fares.'
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journey card                                                        */
/* ------------------------------------------------------------------ */

function JourneyCard({
  option, stops, lang, expanded, onToggle, index, highlighted = false
}: {
  option: any;
  stops: Stop[];
  lang: 'rw' | 'en';
  expanded: boolean;
  onToggle: () => void;
  index: number;
  highlighted?: boolean;
}) {
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const stopById = (id: number) => stops.find((s) => s.id === id);

  const isDirect = option.type === 'direct';
  const duration = option.estimated_minutes;
  const fare = option.fare?.amount_rwf;
  const distanceKm = option.distance_m ? (option.distance_m / 1000).toFixed(1) : null;

  return (
    <li
      className={`overflow-hidden rounded-2xl border bg-white transition dark:bg-slate-900 ${
        highlighted
          ? 'border-violet-300 ring-2 ring-violet-200 dark:border-violet-700 dark:ring-violet-900/50'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      }`}
    >
      {highlighted && (
        <div className="flex items-center gap-1.5 border-b border-violet-100 bg-violet-50 px-4 py-1.5 dark:border-violet-900/40 dark:bg-violet-950/40">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-violet-600 dark:text-violet-400">
            <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300">
            {t('AI irasaba iyi nzira', 'AI recommended')}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4 p-5">
        {/* Routes badges */}
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {isDirect ? (
            <RoutePill
              code={option.route.code}
              color={option.route.color}
              title={lang === 'rw' ? option.route.name_rw : option.route.name_en}
            />
          ) : (
            option.legs.map((l: any, k: number) => (
              <RoutePill
                key={k}
                code={l.route.code}
                color={l.route.color}
                title={lang === 'rw' ? l.route.name_rw : l.route.name_en}
              />
            ))
          )}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              {isDirect ? (
                t('Inzira itaziguye', 'Direct route')
              ) : (
                t(`${option.legs.length - 1} ihinduka`, `${option.legs.length - 1} transfer`)
              )}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {t(`Ihitamo #${index + 1}`, `Option #${index + 1}`)}
              </span>
            </p>
          </div>

          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Metric label={t('Igihe', 'Duration')} value={duration ? `~${duration} min` : '—'} />
            {distanceKm && <Metric label={t('Intera', 'Distance')} value={`${distanceKm} km`} />}
            <Metric
              label={t('Igiciro', 'Fare')}
              value={fare ? `${fare} RWF` : '—'}
              tone="emerald"
              hint={option.fare?.source === 'formula' ? t('(formula)', '(formula)') : undefined}
            />
          </dl>
        </div>

        <button
          onClick={onToggle}
          className="flex-shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {expanded ? t('Funga', 'Hide steps') : t('Reba intambwe', 'Show steps')}
        </button>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          {isDirect ? (
            <Steps
              steps={[
                `${t('Fata', 'Board')} ${option.route.code} ${t('kuri', 'at')} ${
                  stopById(option.fromStopId)?.name_en || `#${option.fromStopId}`
                }`,
                `${t('Komeza', 'Ride')} ${countStops(option, stops)} ${t('ahantu', 'stops')}`,
                `${t('Manuka', 'Alight')} ${t('kuri', 'at')} ${
                  stopById(option.toStopId)?.name_en || `#${option.toStopId}`
                }`
              ]}
            />
          ) : (
            <Steps
              steps={option.legs.flatMap((l: any, k: number) => {
                const out = [
                  `${t('Fata', 'Board')} ${l.route.code} ${t('kuri', 'at')} ${
                    stopById(l.fromStopId)?.name_en || `#${l.fromStopId}`
                  }`
                ];
                if (k < option.legs.length - 1) {
                  out.push(
                    `${t('Hindura', 'Transfer')} ${t('kuri', 'at')} ${
                      stopById(l.toStopId)?.name_en || `#${l.toStopId}`
                    }`
                  );
                } else {
                  out.push(
                    `${t('Manuka', 'Alight')} ${t('kuri', 'at')} ${
                      stopById(l.toStopId)?.name_en || `#${l.toStopId}`
                    }`
                  );
                }
                return out;
              })}
            />
          )}
        </div>
      )}
    </li>
  );
}

function RoutePill({ code, color, title }: { code: string; color: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {code}
    </span>
  );
}

function Metric({
  label, value, tone = 'default', hint
}: { label: string; value: string; tone?: 'default' | 'emerald'; hint?: string }) {
  const color = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white';
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`font-semibold ${color}`}>
        {value}
        {hint && <span className="ml-1 text-[10px] font-normal text-slate-400">{hint}</span>}
      </dd>
    </div>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
            {i + 1}
          </span>
          <span className="text-sm text-slate-700 dark:text-slate-300">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function countStops(option: any, stops: Stop[]): number {
  return Math.max(1, Math.round((option.estimated_minutes || 15) / 3));
}