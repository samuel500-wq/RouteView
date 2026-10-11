'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const MiniFleetMap = dynamic(() => import('@/components/MiniFleetMap'), { ssr: false });

export default function Hero({ routes, stops, vehicles, health, alerts }: any) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const liveCount = vehicles.length;
  const simulatedCount = vehicles.filter((v: any) => v.simulated).length;
  const systemOk = health?.ok === true;
  const topAlert = alerts?.[0];

  return (
    <section className="relative overflow-hidden bg-white dark:bg-slate-950">
      {/* Soft decorative blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-sky-100 via-sky-50 to-transparent opacity-70 blur-3xl dark:from-sky-950/40 dark:via-sky-950/20" />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-emerald-100 via-emerald-50 to-transparent opacity-70 blur-3xl dark:from-emerald-950/40 dark:via-emerald-950/20" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-14 sm:pt-16 lg:pb-24 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* LEFT */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('Kigali · Rwanda · Ubwikorezi bwa rusange', 'Kigali · Rwanda · Public transport')}
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[56px] dark:text-white">
              {t('Ubwikorezi bwa ', 'Public transport, ')}
              <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                {t('Kigali, ubu mu buryo bushya.', 'reimagined for Kigali.')}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Shakisha ingendo, kurikirana bisi mu gihe nyacyo, saba bileti za digitale, kandi ubone ubufasha bw’ubwenge — byose ku rubuga rumwe rworoshye kandi rwizewe.',
                'Plan journeys, track buses live, book digital tickets, and get intelligent travel help — all on one platform built for the way Rwanda moves.'
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/plan"
                className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {t('Tegura urugendo', 'Plan a journey')}
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                {t('Reba bisi kuri ikarita', 'See live map')}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <Badge>{t('Nta kwiyandikisha', 'No signup to browse')}</Badge>
              <Badge>{t('Kinyarwanda cyangwa Icyongereza', 'Kinyarwanda or English')}</Badge>
              <Badge>{t('Ikora kuri telefone', 'Works on any phone')}</Badge>
            </div>
          </div>

          {/* RIGHT — live dashboard preview */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-sky-200/40 via-transparent to-emerald-200/40 blur-2xl" />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t('Ubuzima bw’urubuga', 'Network · live')}
                </p>
              </div>

              <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                <MiniFleetMap vehicles={vehicles} stops={stops} />
              </div>

              <div className="grid grid-cols-3 gap-2 px-1 pt-3">
                <MiniStat label={t('Bisi ubu', 'Buses now')} value={liveCount || '—'} accent="sky" />
                <MiniStat label={t('Ingendo', 'Routes')} value={routes.length || '—'} accent="emerald" />
                <MiniStat label={t('Sisitemu', 'System')} value={systemOk ? 'Online' : '—'} accent={systemOk ? 'emerald' : 'muted'} small />
              </div>

              {simulatedCount > 0 && (
                <p className="px-2 pb-1 pt-2 text-[10px] text-slate-400">
                  {t(
                    `Imenyesha: ${simulatedCount} muri ${liveCount} ni ibigereranyo.`,
                    `Note: ${simulatedCount} of ${liveCount} positions are simulated for this demonstration.`
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Alert banner */}
        {topAlert && (
          <div className="mt-14 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                {t('Itangazo ry’ingendo', 'Service notice')}
              </p>
              <p className="mt-1 font-medium text-amber-900 dark:text-amber-100">
                {t(topAlert.title_rw, topAlert.title_en)}
              </p>
              <p className="text-sm text-amber-800/90 dark:text-amber-200/80">
                {t(topAlert.body_rw, topAlert.body_en)}
              </p>
            </div>
          </div>
        )}

        {/* Trust strip */}
        <div className="mt-14 grid grid-cols-2 gap-6 border-t border-slate-100 pt-10 sm:grid-cols-4 dark:border-slate-800">
          <TrustItem value={routes.length || '4'} label={t('Ingendo z’urugero', 'Routes in the network')} />
          <TrustItem value={stops.length || '10'} label={t('Ahantu ho guhagarara', 'Stops mapped')} />
          <TrustItem value="2" label={t('Indimi zishyigikiwe', 'Languages supported')} />
          <TrustItem value="24/7" label={t('Kubona amakuru', 'Information access')} />
        </div>
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {children}
    </span>
  );
}

function MiniStat({ label, value, accent, small }: { label: string; value: any; accent: 'sky' | 'emerald' | 'muted'; small?: boolean }) {
  const color =
    accent === 'sky' ? 'text-sky-600 dark:text-sky-400'
    : accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-slate-400';
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`${small ? 'text-sm' : 'text-lg'} font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function TrustItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}