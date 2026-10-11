'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export default function AiInsights() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'ai' | 'rules' | null>(null);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.adminAiInsights(lang)
      .then((r) => {
        if (cancelled) return;
        setSource(r.source);
        setInsights(r.insights || []);
      })
      .catch(() => {
        if (!cancelled) setInsights([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [lang]);

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-sky-950/20">
      <header className="flex items-center gap-2 border-b border-violet-200/60 px-5 py-3 dark:border-violet-900/40">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Sparkle />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            {t('Incamake y’ubwenge', 'AI insights')}
          </p>
          <p className="text-[10px] text-violet-600 dark:text-violet-400">
            {source === 'ai'
              ? t('Bishingiye ku mibare y’urubuga', 'Grounded in live RouteView data')
              : source === 'rules'
              ? t('Bishingiye ku mibare gusa', 'Rule-based (AI not configured)')
              : t('Turashakisha…', 'Loading…')}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
          source === 'ai'
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}>
          {source === 'ai' ? 'AI' : source === 'rules' ? t('Amategeko', 'Rules') : '—'}
        </span>
      </header>

      <div className="space-y-2 p-4">
        {loading && (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/60 dark:bg-slate-800/40" />
            ))}
          </>
        )}

        {!loading && insights.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">
            {t('Nta ncamake ihari ubu.', 'No insights available yet.')}
          </p>
        )}

        {!loading && insights.map((ins, i) => (
          <InsightRow key={i} {...ins} />
        ))}
      </div>
    </section>
  );
}

function InsightRow({ tone, title, body }: any) {
  const tones: Record<string, { dot: string; bg: string; border: string }> = {
    positive: { dot: 'bg-emerald-500', bg: 'bg-emerald-50/70 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900/40' },
    warning:  { dot: 'bg-amber-500',   bg: 'bg-amber-50/70 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-900/40' },
    info:     { dot: 'bg-sky-500',     bg: 'bg-sky-50/70 dark:bg-sky-950/20',       border: 'border-sky-200 dark:border-sky-900/40' }
  };
  const t = tones[tone] || tones.info;
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-3`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.dot}`} />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
        </div>
      </div>
    </div>
  );
}

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}