'use client';
import { useI18n } from '@/lib/i18n';

type Arrival = {
  route_code: string;
  route_color: string;
  stop_name: string;
  seconds: number;
  minutes: number;
  source: string;
  model_version: string | null;
  simulated: boolean;
};

export default function AiRecommendation({
  recommendation, arrivals
}: {
  recommendation: { best_option_index: number; reasons: string[]; tips: string[]; summary: string };
  arrivals: Arrival[];
}) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-5 dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:p-6">
      {/* AI badge */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
          </svg>
          AI
        </span>
        {recommendation.reasons.map((r, i) => (
          <span key={i} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300">
            {r}
          </span>
        ))}
      </div>

      {/* Summary headline */}
      <p className="mt-3 text-base font-semibold leading-snug text-slate-900 dark:text-white">
        {recommendation.summary}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Tips */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            {t('Ibyo ukwiye kumenya', 'What to know')}
          </p>
          <ul className="mt-2 space-y-2">
            {recommendation.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Live arrivals from the ML model */}
        {arrivals.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {t('Ibihe bizagera (model)', 'Next arrivals (model)')}
            </p>
            <ul className="mt-2 space-y-2">
              {arrivals.slice(0, 3).map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span
                    className="flex h-8 min-w-[36px] items-center justify-center rounded-lg px-2 text-xs font-bold text-white"
                    style={{ backgroundColor: a.route_color }}
                  >
                    {a.route_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {a.minutes === 0
                        ? t('Iri hafi', 'Arriving now')
                        : `~${a.minutes} ${t('min', 'min')}`}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {t('Kuri', 'At')} {a.stop_name}
                      {a.simulated && <span className="ml-1 text-amber-500">· {t('sim', 'sim')}</span>}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      a.source === 'model'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    title={
                      a.source === 'model'
                        ? `ML model v${a.model_version}`
                        : 'Physics-based fallback'
                    }
                  >
                    {a.source === 'model' ? 'ML' : 'FB'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-slate-400">
              {t(
                'Bibarwa na moderi yacu ya Python ukoresheje urugendo n’umuvuduko.',
                'Computed by our Python model from distance and speed.'
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}