'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function ImageStrip() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  return (
    <section className="bg-white py-20 sm:py-24 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
            {t('Kigali · Rwanda', 'Kigali · Rwanda')}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {t(
              'Urubuga rwakorewe imijyi y’u Rwanda.',
              'Built for the way Rwandan cities move.'
            )}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {t(
              'Tugamije guhuza ubwikorezi busanzwe n’ikoranabuhanga rigezweho — binyuze mu ikarita, telefone, na sisitemu z’ubwikorezi.',
              'We bring public transport and modern technology together — through maps, phones, and operator systems.'
            )}
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Upper placeholder — homepage.png */}
          <Feature
            src="/homepage.png"
            alt="RouteView platform overview"
            kicker={t('Urubuga', 'The platform')}
            title={t('Ikarita n’amakuru mu buryo bumwe.', 'Everything in one view.')}
            body={t(
              'Ahantu hamwe ushobora kubona ingendo, ibisi, ahantu ho guhagarara, n’ibihe bizagera — kuri telefone cyangwa mudasobwa.',
              'One place to see routes, vehicles, stops, and arrival times — on any device.'
            )}
            cta={{ href: '/map', label: t('Reba ikarita', 'Open the map') }}
          />

          {/* Second placeholder — Bus.jpg */}
          <Feature
            src="/Bus.jpg"
            alt="A public bus on the road"
            kicker={t('Ubwikorezi', 'Transport')}
            title={t('Bisi ziri mu nzira, ubu nyine.', 'Buses on the move, in real time.')}
            body={t(
              'Dukurikirana imodoka ku nzira zazo, tugahita tubara igihe zizagera ku kigo ukoresheje moderi yacu bwite.',
              'We track vehicles along their routes and estimate arrival times using our own model.'
            )}
            cta={{ href: '/routes', label: t('Reba ingendo', 'Browse routes') }}
          />
        </div>
      </div>
    </section>
  );
}

function Feature({
  src, alt, kicker, title, body, cta
}: {
  src: string;
  alt: string;
  kicker: string;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition duration-700 group-hover:scale-[1.03]"
          priority={false}
        />
      </div>
      <div className="p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          {kicker}
        </p>
        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </p>
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 transition hover:gap-2.5 dark:text-sky-400"
        >
          {cta.label}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}