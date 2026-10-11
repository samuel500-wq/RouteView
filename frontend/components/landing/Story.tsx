'use client';
import { useI18n } from '@/lib/i18n';

export default function Story() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  return (
    <>
      {/* PROBLEM */}
      <section className="border-t border-slate-100 bg-white py-20 sm:py-28 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              {t('Ingorane', 'The problem')}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t(
                'Kumenya ingendo ya bisi bitoroshye muri Kigali.',
                'Getting around Kigali by bus is harder than it needs to be.'
              )}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Abagenzi bata amasaha ku kigo nta makuru, ntibamenye igiciro mbere, kandi ntibashobora kumenya aho bisi iri cyangwa igihe izagera. Abakoresha ubu bwoko bw’ubwikorezi ntibabona amakuru ahagije kugira ngo bafate ibyemezo byiza.',
                'Passengers wait at stops without information, don’t know fares in advance, and can’t see where their bus is. Operators lack the visibility to run services efficiently.'
              )}
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Problem
              icon={<Clock />}
              title={t('Gutegereza nta makuru', 'Waiting blind')}
              body={t(
                'Nta kumenya igihe bisi izagera cyangwa niba yagiye mu nzira.',
                'No way to know when the next bus is coming, or whether it has already left.'
              )}
              accent="amber"
            />
            <Problem
              icon={<Question />}
              title={t('Ibiciro bitazwi mbere', 'Unclear fares')}
              body={t(
                'Abagenzi bamenya igiciro bageze mu bisi, bakoresha amafaranga.',
                'Fares are only revealed once you board, often with cash-only transactions.'
              )}
              accent="rose"
            />
            <Problem
              icon={<Eye />}
              title={t('Nta kwerekana ibikorwa', 'No visibility')}
              body={t(
                'Abakoresha ubwikorezi ntibabona imiterere y’ibisi cyangwa ingendo.',
                'Operators lack the data to see where vehicles are or how routes perform.'
              )}
              accent="violet"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-50 py-20 sm:py-28 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              {t('Igisubizo', 'The solution')}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              {t('RouteView ihuza abagenzi n’ubwikorezi.', 'RouteView connects riders and vehicles.')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Urubuga rumwe rukusanya amakuru, ibikoresho, na serivisi zo kwiyegereza — kuburyo bworoshye kuri telefone no kuri mudasobwa.',
                'One platform gathers information, tools and services in one place — designed to work well on phones and desktops.'
              )}
            </p>
          </div>

          <ol className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-6">
            <Step
              n="01"
              title={t('Shakisha', 'Discover')}
              body={t(
                'Shyiramo aho uva n’aho ujya ubone inzira nziza, igiciro n’igihe.',
                'Enter origin and destination to see route options, fares and journey times.'
              )}
            />
            <Step
              n="02"
              title={t('Kurikirana', 'Track')}
              body={t(
                'Reba bisi zose kuri ikarita, hamwe n’ibihe bizagera ku kigo.',
                'Watch every vehicle on the map, with arrival times computed in real time.'
              )}
            />
            <Step
              n="03"
              title={t('Tegura', 'Pay & ride')}
              body={t(
                'Saba bileti ya digitale, ubone QR, uyishyire ku mubariza.',
                'Book a digital ticket, receive a QR code, and have it validated by an operator.'
              )}
            />
          </ol>
        </div>
      </section>
    </>
  );
}

function Problem({ icon, title, body, accent }: { icon: React.ReactNode; title: string; body: string; accent: 'amber' | 'rose' | 'violet' }) {
  const accents = {
    amber:  { bg: 'bg-amber-50 dark:bg-amber-950/30', fg: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-100 dark:ring-amber-900/40' },
    rose:   { bg: 'bg-rose-50 dark:bg-rose-950/30',   fg: 'text-rose-600 dark:text-rose-400',   ring: 'ring-rose-100 dark:ring-rose-900/40' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', fg: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-100 dark:ring-violet-900/40' }
  };
  const a = accents[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${a.bg} ${a.fg} ${a.ring}`}>
        {icon}
      </div>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="relative">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold tabular-nums text-slate-400">{n}</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </li>
  );
}

function Clock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function Question() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}