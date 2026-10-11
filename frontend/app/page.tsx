'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const MiniFleetMap = dynamic(() => import('@/components/MiniFleetMap'), { ssr: false });

export default function Home() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [routes, setRoutes] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [icStats, setIcStats] = useState<{ destinations: number; provinces: number } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.listRoutes().then((r) => setRoutes(r.routes)).catch(() => {});
    api.listStops().then((r) => setStops(r.stops)).catch(() => {});
    api.alerts().then((r) => setAlerts(r.alerts)).catch(() => {});

    // Intercity destinations count
    api.intercityDestinations()
      .then((r) => setIcStats({
        destinations: r.destinations?.length || 0,
        provinces: r.provinces?.length || 0
      }))
      .catch(() => {});

    let cancelled = false;
    const tick = async () => {
      try {
        const r = await api.vehicles();
        if (!cancelled) setVehicles(r.vehicles);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const liveCount = vehicles.length;
  const simulatedCount = vehicles.filter((v: any) => v.simulated).length;
  const gpsCount = liveCount - simulatedCount;
  const systemOk = health?.ok === true;
  const topAlert = alerts?.[0];

  return (
    <div className="space-y-16 pb-10 sm:space-y-20">

      {/* ============================================================
          HERO
          ============================================================ */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-sky-50/40 to-emerald-50/40 dark:border-slate-800 dark:from-slate-950 dark:via-sky-950/20 dark:to-emerald-950/20">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-sky-200/50 to-transparent blur-3xl dark:from-sky-900/30" />
          <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-emerald-200/50 to-transparent blur-3xl dark:from-emerald-900/30" />
        </div>

        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:p-12">
          {/* Left column */}
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t('Kigali · u Rwanda', 'Kigali · Rwanda')}
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[56px] dark:text-white">
              {t('Ubwikorezi bwa ', 'Public transport, ')}
              <span className="bg-gradient-to-r from-sky-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                {t('Rwanda, bworoshye.', 'reimagined.')}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              {t(
                'Shakisha ingendo mu mujyi, kurikirana bisi, saba bileti za digitale kuva mu Kigali ujya mu ntara zose, kandi ubone ubufasha bw’ubwenge — byose ahantu hamwe.',
                'Plan city journeys, track buses live, book digital tickets from Kigali to every province, and get AI travel help — all in one place.'
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
                href="/tickets"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                {t('Saba bileti', 'Book tickets')}
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <Feature label={t('Kinyarwanda n’Icyongereza', 'Kinyarwanda & English')} />
              <Feature label={t('Bikora kuri telefone', 'Works on any phone')} />
              <Feature label={t('Ubufasha bwa AI', 'AI-powered help')} />
            </ul>
          </div>

          {/* Right column — live dashboard preview */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-sky-200/40 via-transparent to-emerald-200/40 blur-2xl dark:from-sky-900/20 dark:to-emerald-900/20" />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
              {/* Window chrome */}
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

              {/* Live mini map */}
              <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                <MiniFleetMap vehicles={vehicles} stops={stops} />
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 px-1 pt-3">
                <MiniStat label={t('Bisi ubu', 'Buses now')} value={liveCount || '—'} accent="sky" />
                <MiniStat label={t('Ingendo', 'Routes')} value={routes.length || '—'} accent="emerald" />
                <MiniStat
                  label={t('Sisitemu', 'System')}
                  value={systemOk ? 'Online' : '—'}
                  accent={systemOk ? 'emerald' : 'muted'}
                  small
                />
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
          <div className="relative mx-6 mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:mx-10 lg:mx-12 dark:border-amber-900/60 dark:bg-amber-950/30">
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
      </section>

      {/* ============================================================
          TRUST STRIP
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <MetricCard
            value={routes.length || 4}
            label={t('Ingendo z’umujyi', 'Urban routes')}
            hint={t('Mu Kigali', 'In Kigali')}
            accent="sky"
          />
          <MetricCard
            value={stops.length || 10}
            label={t('Ahantu ho guhagarara', 'Stops mapped')}
            hint={t('Ku rubuga', 'On the network')}
            accent="violet"
          />
          <MetricCard
            value={icStats?.destinations || 24}
            label={t('Ingendo z’intara', 'Interprovincial')}
            hint={icStats?.provinces ? `${icStats.provinces} ${t('ntara', 'provinces')}` : t('mu Rwanda hose', 'across Rwanda')}
            accent="emerald"
          />
          <MetricCard
            value="2"
            label={t('Indimi', 'Languages')}
            hint="Kinyarwanda · English"
            accent="amber"
          />
        </div>
      </section>

      {/* ============================================================
          QUICK ACTIONS
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <SectionHeader
          kicker={t('Tangira vuba', 'Get started')}
          title={t('Ibikorwa by’ibanze', 'Everything you need')}
          subtitle={t(
            'Uhereye ku itegura ry’urugendo ukagera ku bileti — RouteView ihuza ibikorwa byose.',
            'From planning to ticketing — RouteView brings every step of the journey together.'
          )}
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/plan"
            icon={<PlanIcon />}
            title={t('Tegura urugendo', 'Plan a journey')}
            desc={t(
              'Shyiramo aho uva n’aho ujya, ubone inzira, igihe n’igiciro.',
              'Enter origin and destination to see routes, transfers and fares.'
            )}
            accent="sky"
          />
          <ActionCard
            href="/map"
            icon={<MapIcon />}
            title={t('Kurikirana bisi', 'Track live')}
            desc={t(
              'Reba bisi zose ku ikarita mu gihe nyacyo, hamwe n’ibihe bizagera.',
              'Watch every vehicle move on the map with live arrival estimates.'
            )}
            accent="emerald"
          />
          <ActionCard
            href="/tickets"
            icon={<TicketIcon />}
            title={t('Bileti z’intara', 'Interprovincial tickets')}
            desc={t(
              'Saba bileti uvuye i Nyabugogo ujya mu ntara zose z’u Rwanda.',
              'Book tickets from Nyabugogo to every Rwandan province.'
            )}
            accent="violet"
          />
          <ActionCard
            href="/places"
            icon={<PinIcon />}
            title={t('Shakisha ahantu', 'Find places')}
            desc={t(
              'Baza umufasha mu magambo yawe, ubone ahantu hafi nawe.',
              'Ask the assistant in your own words, find places near you.'
            )}
            accent="amber"
          />
        </div>
      </section>

      {/* ============================================================
          INTERPROVINCIAL SHOWCASE
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white shadow-xl dark:border-slate-800">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:gap-12 lg:p-14">
            {/* Left: text */}
            <div className="flex flex-col justify-center">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t('Bishya · Interprovincial', 'New · Interprovincial')}
              </span>

              <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                {t('Ingendo kuva i Kigali ujya mu ntara zose.', 'From Kigali to every province.')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                {t(
                  'Saba bileti ya bisi kuva i Nyabugogo ujya i Musanze, Rubavu, Huye, Rusizi, Rwamagana, Nyagatare n’ahandi. Bona QR code icapishwa, umudereva ayisome rimwe gusa.',
                  'Book bus tickets from Nyabugogo to Musanze, Rubavu, Huye, Rusizi, Rwamagana, Nyagatare and more. Get a printable QR code the driver scans exactly once.'
                )}
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <ProvinceStat
                  count={5}
                  label={t('Intara', 'Provinces')}
                  sub="Northern · Southern · Eastern · Western"
                />
                <ProvinceStat
                  count={icStats?.destinations || 24}
                  label={t('Ahantu ujya', 'Destinations')}
                  sub={t('Biva i Nyabugogo', 'From Nyabugogo')}
                />
              </div>

              <Link
                href="/tickets"
                className="group mt-8 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                {t('Saba bileti ubu', 'Book a ticket')}
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            {/* Right: province list */}
            <div className="space-y-3">
              <ProvinceRow
                color="#0ea5e9"
                name={t('Amajyaruguru', 'Northern Province')}
                cities={['Musanze', 'Gicumbi', 'Rulindo', 'Gakenke', 'Burera']}
                fromPrice={1500}
              />
              <ProvinceRow
                color="#10b981"
                name={t('Amajyepfo', 'Southern Province')}
                cities={['Huye', 'Nyanza', 'Muhanga', 'Ruhango', 'Nyamagabe']}
                fromPrice={1200}
              />
              <ProvinceRow
                color="#f59e0b"
                name={t('Iburasirazuba', 'Eastern Province')}
                cities={['Rwamagana', 'Kayonza', 'Nyagatare', 'Nyamata', 'Kirehe']}
                fromPrice={1000}
              />
              <ProvinceRow
                color="#8b5cf6"
                name={t('Iburengerazuba', 'Western Province')}
                cities={['Rubavu', 'Karongi', 'Rusizi', 'Nyabihu', 'Nyamasheke']}
                fromPrice={3000}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <SectionHeader
          kicker={t('Uko bikora', 'How it works')}
          title={t('Intambwe eshatu.', 'Three simple steps.')}
          subtitle={t(
            'RouteView ihuza abagenzi, ibisi n’amakuru mu buryo bumwe bworoshye.',
            'RouteView connects passengers, vehicles and information in one simple flow.'
          )}
        />

        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          <Step
            n="01"
            title={t('Shakisha', 'Discover')}
            body={t(
              'Shyiramo aho uva n’aho ujya cyangwa baza umufasha mu magambo yawe. Ubona inzira n’igiciro.',
              'Enter origin and destination, or ask the assistant in your own words. See routes and fares.'
            )}
          />
          <Step
            n="02"
            title={t('Kurikirana', 'Track')}
            body={t(
              'Reba bisi ziri mu muhanda ubu, n’ibihe bizagera ku kigo ukoresheje moderi yacu bwite.',
              'Watch live vehicles on the map and see arrival times computed by our own ML model.'
            )}
          />
          <Step
            n="03"
            title={t('Tegura', 'Book & ride')}
            body={t(
              'Saba bileti ya digitale, ubone QR code, uyishyire ku mudereva cyangwa umukoresha w’ubwikorezi.',
              'Book a digital ticket, receive a QR code, and have it validated by a driver or operator.'
            )}
          />
        </ol>
      </section>

      {/* ============================================================
          FEATURE GRID
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <SectionHeader
          kicker={t('Ibikoresho', 'Capabilities')}
          title={t('Ibintu byose abagenzi n’abakoresha bakeneye.', 'Everything riders and operators need.')}
          subtitle={t(
            'Uhereye ku ikarita ukagera ku bileti ukagera ku bufasha bw’ubwenge.',
            'From maps to tickets to intelligent assistance — one coherent platform.'
          )}
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<MapIcon />}
            title={t('Ikarita y’ibihe nyacyo', 'Live map')}
            body={t(
              'Reba bisi zose ku ikarita, hamwe n’inzira zazo, ibihe bizagera n’abagenzi bari muri zo.',
              'See every vehicle on the map with its route, next stop, and passenger load.'
            )}
            accent="sky"
          />
          <FeatureCard
            icon={<SparkIcon />}
            title={t('Ubwenge bwa ML', 'ML-powered arrivals')}
            body={t(
              'Ibihe bizagera bibazwa na moderi yacu bwite ya Python ukoresheje urugendo n’umuvuduko.',
              'Arrival times predicted by our own Python model using distance and speed.'
            )}
            accent="violet"
          />
          <FeatureCard
            icon={<BusIcon />}
            title={t('Bileti za digitale', 'Digital tickets')}
            body={t(
              'Saba, ishyura (demo), ubone QR code icapishwa. Umudereva ayisoma rimwe gusa.',
              'Book, pay (demo), and receive a printable QR code the driver scans exactly once.'
            )}
            accent="amber"
          />
          <FeatureCard
            icon={<PinIcon />}
            title={t('Ahantu hafi', 'Find places nearby')}
            body={t(
              'Baza umufasha aho ushobora kurya, kugura imiti cyangwa kubona ATM hafi yawe.',
              'Ask the assistant where to eat, buy medicine, or find an ATM near you.'
            )}
            accent="emerald"
          />
          <FeatureCard
            icon={<SparkIcon />}
            title={t('Umufasha w’ubwenge', 'AI assistant')}
            body={t(
              'Baza mu Kinyarwanda cyangwa Icyongereza. Asubiza ashingiye ku makuru y’urubuga.',
              'Ask in Kinyarwanda or English. It answers using real network data.'
            )}
            accent="violet"
          />
          <FeatureCard
            icon={<ShieldIcon />}
            title={t('Umutekano', 'Secure by default')}
            body={t(
              'JWT auth, bcrypt password hashing, role-based access, single-use tickets.',
              'JWT auth, bcrypt password hashing, role-based access, single-use tickets.'
            )}
            accent="sky"
          />
        </div>
      </section>

      {/* ============================================================
          AI ASSISTANT CALLOUT
          ============================================================ */}
      <section className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 sm:p-10 lg:p-12 dark:border-violet-900/60 dark:from-violet-950/40 dark:via-slate-900 dark:to-sky-950/30">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                <SparkIcon />
                RouteView Assistant
              </span>

              <h2 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                {t('Baza ikibazo mu magambo yawe.', 'Ask a question in your own words.')}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
                {t(
                  'Umufasha wacu akoresha OpenRouter kugira ngo agufashe gusobanukirwa. Ariko ibisubizo biboneka mu makuru nyayo y’urubuga — ntabwo aduhisha ingendo cyangwa ibiciro.',
                  'Our assistant uses OpenRouter to understand you. But every answer comes from real network data through controlled tool calls — it never invents routes or fares.'
                )}
              </p>

              <div className="mt-6 space-y-2.5">
                <ExampleLine
                  question={t('“Nifasha kugera Kimironko nte?”', '"How do I get to Kimironko?"')}
                  answer={t('Fata R1 kuri Nyabugogo ujye i Kimironko. ~21 min. 850 RWF.', 'Take R1 from Nyabugogo to Kimironko. ~21 min. 850 RWF.')}
                />
                <ExampleLine
                  question={t('“Igihe bisi izagera?”', '"When is the next bus?"')}
                  answer={t('Bisi R1 izagera mu minota ~3 kuri Nyabugogo.', 'Bus R1 arrives at Nyabugogo in ~3 min.')}
                />
                <ExampleLine
                  question={t('“Aho nshobora kurya hafi?”', '"Where can I eat nearby?"')}
                  answer={t('Ahantu 5 hafi yawe. Moto ~1,200 RWF cyangwa bisi R2 ~850 RWF.', '5 places near you. Moto ~1,200 RWF or bus R2 ~850 RWF.')}
                />
              </div>

              <p className="mt-6 text-xs text-slate-500">
                {t(
                  'Kanda akantu k’umufasha hepfo iburyo kugira ngo utangire.',
                  'Click the assistant button in the bottom-right corner to start.'
                )}
              </p>
            </div>

            {/* Visual mockup */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-violet-300/30 to-sky-300/30 blur-2xl dark:from-violet-900/40 dark:to-sky-900/40" />
              <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
                    <SparkIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">RouteView Assistant</p>
                    <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Online
                    </p>
                  </div>
                </div>

                <div className="space-y-2 py-3">
                  <div className="ml-8 rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-xs text-white dark:bg-white dark:text-slate-900">
                    {t('Nifasha kugera Kimironko nte?', 'How do I get to Kimironko?')}
                  </div>
                  <div className="mr-8 rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    <p className="mb-1.5 inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                      {t('Tools', 'Tools')}
                    </p>
                    <div className="space-y-0.5 font-mono text-[10px] text-slate-500">
                      <p>· find_stops(&quot;Kimironko&quot;)</p>
                      <p>· plan_journey(from, to)</p>
                      <p>· fare_between(route, from, to)</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-800 dark:text-slate-200">
                      {t('Fata R1 kuri Nyabugogo. ~21 min. 850 RWF.', 'Take R1 from Nyabugogo. ~21 min. 850 RWF.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          CLOSING CTA
          ============================================================ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-sky-700 to-emerald-600 p-10 text-center text-white sm:p-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
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
            <Link
              href="/plan"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-sky-700 shadow-lg transition hover:bg-slate-100"
            >
              {t('Tegura urugendo', 'Plan a journey')}
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/tickets"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              {t('Saba bileti', 'Book tickets')}
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
          ============================================================ */}
      <footer className="mx-auto max-w-6xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500" />
              <span className="text-base font-semibold text-slate-900 dark:text-white">RouteView</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t(
                'Urubuga rw’ubwikorezi bwa rusange rwakorewe u Rwanda.',
                'A public transport platform built for Rwanda.'
              )}
            </p>
          </div>

          <FooterCol title={t('Abagenzi', 'Passengers')}>
            <FooterLink href="/plan">{t('Tegura urugendo', 'Plan a journey')}</FooterLink>
            <FooterLink href="/map">{t('Ikarita', 'Live map')}</FooterLink>
            <FooterLink href="/routes">{t('Ingendo', 'Routes')}</FooterLink>
            <FooterLink href="/places">{t('Ahantu', 'Places')}</FooterLink>
          </FooterCol>

          <FooterCol title={t('Bileti', 'Tickets')}>
            <FooterLink href="/tickets">{t('Bileti z’intara', 'Interprovincial')}</FooterLink>
            <FooterLink href="/tickets">{t('Bileti zanjye', 'My bookings')}</FooterLink>
          </FooterCol>

          <FooterCol title={t('Abakoresha', 'Operators')}>
            <FooterLink href="/admin/login">{t('Injira mu kibaho', 'Staff sign-in')}</FooterLink>
            <FooterLink href="/admin">{t('Ikibaho', 'Dashboard')}</FooterLink>
            <FooterLink href="/admin/validate">{t('Genzura bileti', 'Validate ticket')}</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} RouteView. {t('Urubuga rwa demonstration.', 'Demonstration platform.')}
          </p>
          <p className="text-xs text-slate-400">
            {t(
              'Ingendo, ibiciro n’imiterere y’ibisi ni ibigereranyo keretse byanditse ko ari GPS.',
              'Routes, fares and vehicle positions are sample data unless labelled as GPS.'
            )}
          </p>
        </div>
      </footer>

      {/* Live badge */}
      <div className="pointer-events-none fixed bottom-5 left-5 z-40 hidden items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[10px] font-semibold shadow-md backdrop-blur sm:flex dark:border-slate-800 dark:bg-slate-900/90">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${systemOk ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-slate-600 dark:text-slate-300">
          {systemOk
            ? `${gpsCount} GPS · ${simulatedCount} ${t('ibigereranyo', 'sim')}`
            : t('Sisitemu ifunze', 'System offline')}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   Building blocks
   ================================================================ */

function Feature({ label }: { label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {label}
    </li>
  );
}

function MiniStat({ label, value, accent, small }: {
  label: string;
  value: any;
  accent: 'sky' | 'emerald' | 'muted';
  small?: boolean;
}) {
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

function MetricCard({ value, label, hint, accent }: {
  value: string | number;
  label: string;
  hint?: string;
  accent: 'sky' | 'emerald' | 'violet' | 'amber';
}) {
  const accents = {
    sky:     'from-sky-500/10 to-transparent text-sky-600 dark:text-sky-400',
    emerald: 'from-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-400',
    violet:  'from-violet-500/10 to-transparent text-violet-600 dark:text-violet-400',
    amber:   'from-amber-500/10 to-transparent text-amber-600 dark:text-amber-400'
  }[accent];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${accents.split(' ').slice(0, 2).join(' ')} bg-white p-5 dark:border-slate-800 dark:bg-slate-900`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accents.split(' ').slice(0, 2).join(' ')}`} />
      <div className="relative">
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">{label}</p>
        {hint && <p className={`mt-0.5 text-[10px] ${accents.split(' ').slice(2).join(' ')}`}>{hint}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
        {kicker}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ActionCard({
  href, icon, title, desc, accent
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: 'sky' | 'emerald' | 'violet' | 'amber';
}) {
  const accents = {
    sky:     'from-sky-500/10 to-sky-500/0 text-sky-600 dark:text-sky-400',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
    violet:  'from-violet-500/10 to-violet-500/0 text-violet-600 dark:text-violet-400',
    amber:   'from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-400'
  };
  const a = accents[accent];
  const [bg, , fg] = a.split(' ');
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${bg} opacity-0 transition group-hover:opacity-100`} />
      <div className="relative">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 ${fg}`}>
          {icon}
        </div>
        <p className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{desc}</p>
        <p className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${fg}`}>
          {title}
          <span className="transition group-hover:translate-x-0.5">→</span>
        </p>
      </div>
    </Link>
  );
}

function FeatureCard({
  icon, title, body, accent
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: 'sky' | 'emerald' | 'violet' | 'amber';
}) {
  const accents = {
    sky:     'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    violet:  'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    amber:   'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accents}`}>
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
        <span className="text-sm font-semibold tabular-nums text-sky-600 dark:text-sky-400">{n}</span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </li>
  );
}

function ProvinceStat({ count, label, sub }: { count: number; label: string; sub: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight text-white">{count}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function ProvinceRow({
  color, name, cities, fromPrice
}: {
  color: string;
  name: string;
  cities: string[];
  fromPrice: number;
}) {
  const t = (rw: string, en: string) => en;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-sm font-semibold text-white">{name}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
          from {fromPrice.toLocaleString()} RWF
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cities.map((c) => (
          <span key={c} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExampleLine({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
        U
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-slate-900 dark:text-white">{question}</p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-violet-600 dark:text-violet-400">→</span> {answer}
        </p>
      </div>
    </div>
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

/* ================================================================
   Icons
   ================================================================ */

function PlanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="11" r="3" />
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 6v2M13 10v2M13 14v2M13 18v0" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
    </svg>
  );
}
function BusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Z" />
      <path d="M4 12h16M8 20v-2M16 20v-2" />
      <circle cx="8" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}