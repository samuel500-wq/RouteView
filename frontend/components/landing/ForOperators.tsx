'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function ForOperators({ health }: any) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const tools = [
    { title: t('Kurikirana ibisi', 'Fleet monitoring'),  body: t('Reba imodoka zose ku ikarita mu gihe nyacyo.', 'See every vehicle on a live map with source labels (GPS vs simulator).') },
    { title: t('Gucunga ingendo', 'Route management'),   body: t('Kongera, hindura cyangwa usibe ingendo, ahantu n’ibihe.', 'Create, edit or remove routes, stops, schedules and fares.') },
    { title: t('Kugenzura bileti', 'Ticket validation'), body: t('Soma QR cyangwa wandike kode, hanyuma wemeze.', 'Scan QR codes or enter a ticket reference — the system prevents double use.') },
    { title: t('Itangazo ry’ingendo', 'Service alerts'), body: t('Tangaza ibibazo cyangwa impinduka ku nzira runaka.', 'Publish disruptions or changes for a route or the whole network.') },
    { title: t('Raporo', 'Reports'),                      body: t('Reba ingendo, ibiciro n’imikoreshereze y’urubuga.', 'See bookings, revenue and redemption activity over time.') },
    { title: t('Umutekano', 'Access control'),            body: t('Urwego rw’uburenganzira ku bakoresha b’urubuga.', 'Role-based access — passengers, operators and administrators.') }
  ];

  return (
    <section className="bg-slate-900 py-20 text-white sm:py-28 dark:bg-black">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              {t('Ku bakoresha ubwikorezi', 'For operators')}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('Ibikoresho byo gucunga ubwikorezi.', 'A dashboard built for the people who run the network.')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              {t(
                'Operators, supervisors and administrators get their own interface — separate from the passenger app — with the tools they need to run services day-to-day.',
                'RouteView separates the passenger experience from the operator console. Both share the same source of truth, so information stays consistent everywhere.'
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                {t('Fungura ikibaho', 'Open the console')}
              </Link>
              <Link href="/tickets" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                {t('Injira nka operator', 'Sign in as operator')}
              </Link>
            </div>

            {health && (
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${health.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {health.ok ? t('Sisitemu irakora', 'System online') : t('Sisitemu ifunze', 'System offline')}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((x) => (
              <div key={x.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
                <p className="text-sm font-semibold text-white">{x.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{x.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}