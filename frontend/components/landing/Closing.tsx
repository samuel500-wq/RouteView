'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function Closing() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);
  const year = new Date().getFullYear();

  return (
    <>
      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-emerald-600 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('Tangira urugendo rwawe ubu.', 'Start your journey today.')}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {t(
              'Shyiramo aho uva n’aho ujya. Reba bisi ku ikarita. Saba bileti. Baza umufasha. Byose ahantu hamwe.',
              'Enter your origin and destination. Watch buses move. Book a ticket. Ask the assistant. All in one place.'
            )}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/plan" className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-sky-700 shadow-lg transition hover:bg-slate-100">
              {t('Tegura urugendo', 'Plan a journey')}
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="/map" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10">
              {t('Reba ikarita', 'Open the map')}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500" />
                <span className="text-base font-semibold text-slate-900 dark:text-white">RouteView</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t(
                  'Urubuga rw’ubwikorezi bwa rusange rwakorewe Kigali, Rwanda.',
                  'A public transport platform built for Kigali, Rwanda.'
                )}
              </p>
            </div>

            <FooterCol title={t('Ibikoresho', 'Product')}>
              <FooterLink href="/plan">{t('Tegura urugendo', 'Plan a journey')}</FooterLink>
              <FooterLink href="/map">{t('Ikarita', 'Live map')}</FooterLink>
              <FooterLink href="/routes">{t('Ingendo', 'Routes')}</FooterLink>
              <FooterLink href="/places">{t('Ahantu', 'Places')}</FooterLink>
              <FooterLink href="/tickets">{t('Bileti', 'Tickets')}</FooterLink>
            </FooterCol>

            <FooterCol title={t('Ku bakoresha', 'For operators')}>
              <FooterLink href="/admin">{t('Ikibaho', 'Console')}</FooterLink>
              <FooterLink href="/admin/validate">{t('Kugenzura bileti', 'Validate ticket')}</FooterLink>
              <FooterLink href="/admin/status">{t('Imiterere ya sisitemu', 'System status')}</FooterLink>
            </FooterCol>

            <FooterCol title={t('Amakuru', 'About')}>
              <FooterLink href="/">{t('Ahabanza', 'Home')}</FooterLink>
              <FooterLink href="/plan">{t('Kubona inzira', 'Find your way')}</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-slate-100 pt-8 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © {year} RouteView. {t('Urubuga rwa demonstration.', 'Demonstration platform.')}
            </p>
            <p className="text-xs text-slate-400">
              {t(
                'Ingendo, ibiciro n’imiterere y’ibisi ni ibigereranyo keretse byanditse ko ari GPS.',
                'Routes, fares and vehicle positions are sample data unless labelled as GPS.'
              )}
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-slate-600 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400">
        {children}
      </Link>
    </li>
  );
}