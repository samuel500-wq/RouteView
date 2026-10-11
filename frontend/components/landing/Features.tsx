'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n';

const MiniFleetMap = dynamic(() => import('@/components/MiniFleetMap'), { ssr: false });

export default function Features({ vehicles, routes, stops }: any) {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const showcases = [
    {
      id: 'plan',
      kicker: t('Gutegura urugendo', 'Journey planning'),
      title: t('Shyiramo aho uva n’aho ujya. Ubona inzira.', 'Enter origin and destination. See the route.'),
      body: t(
        'Ushobora kubona inzira nziza, aho uhindura bisi, igihe cyose n’igiciro. Ibiganiro byose bishingiye ku makuru y’urubuga.',
        'RouteView computes direct and one-transfer journeys from the real network, showing distance, estimated time and a demonstration fare.'
      ),
      visual: <VisualPlan routes={routes} />,
      accent: 'sky'
    },
    {
      id: 'track',
      kicker: t('Kurikirana bisi', 'Live tracking'),
      title: t('Reba bisi zose ku ikarita, ubu.', 'See every bus on the map, right now.'),
      body: t(
        'Ikarita igaragaza bisi mu muhanda, hamwe n’uburinganire bw’urugendo n’imiterere y’umuvuduko. Ibara ry’umuhondo = ikigereranyo.',
        'The map shows vehicle positions in real time along their routes, with heading, speed and freshness. Amber markers indicate a simulated feed.'
      ),
      visual: <VisualTrack vehicles={vehicles} stops={stops} />,
      accent: 'emerald'
    },
    {
      id: 'ml',
      kicker: t('Ubwenge bwa ML', 'Machine learning'),
      title: t('Ibihe bizagera bibarwa n’imodoka yacu.', 'Arrival times predicted by our own model.'),
      body: t(
        'Twatoje moderi yacu bwite ikoresheje scikit-learn. Igenekereza igihe bisi izagera ku kigo ukoresheje urugendo, umuvuduko n’ibihe.',
        'We trained our own scikit-learn model. It estimates seconds-to-arrival from remaining distance, recent speed, time of day and remaining stops.'
      ),
      visual: <VisualML />,
      accent: 'violet'
    },
    {
      id: 'tickets',
      kicker: t('Bileti za digitale', 'Digital tickets'),
      title: t('Saba bileti, ubone QR, uyishyire.', 'Book, receive a QR, get validated.'),
      body: t(
        'Ufite konte, ushobora gusaba urugendo ukabuona QR. Umukoresha w’ubwikorezi arayisoma cyangwa ayandike, hanyuma agenzura.',
        'With an account you can book a seat, pay in demonstration mode, and receive a QR code. Operators validate it in the admin interface — the system prevents double redemption.'
      ),
      visual: <VisualTicket />,
      accent: 'amber'
    },
    {
      id: 'ai',
      kicker: t('Umufasha w’ubwenge', 'AI assistant'),
      title: t('Baza mu Kinyarwanda cyangwa Icyongereza.', 'Ask in Kinyarwanda or English.'),
      body: t(
        'Umufasha asubiza ashingiye ku makuru nyayo y’urubuga — ntabwo aduhisha ingendo cyangwa ibiciro. Iyo internet itabonetse, ibisubizo bikomeza kuboneka mu buryo bwigenga.',
        'The assistant answers with facts pulled from RouteView through controlled tool calls — it never invents routes or fares. When the AI provider is unavailable, the rest of the platform keeps working.'
      ),
      visual: <VisualAI />,
      accent: 'rose'
    }
  ];

  return (
    <section className="bg-white py-20 sm:py-28 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
            {t('Ibikoresho', 'Capabilities')}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {t('Ibintu byose abagenzi n’abakoresha bakeneye.', 'Everything riders and operators need.')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {t(
              'Uhereye ku itegura ry’urugendo, ukagera ku ikarita, ukagera ku bileti — RouteView ihuza ibikorwa byose mu buryo bumwe.',
              'From planning to tracking to ticketing, RouteView brings every step of the journey into one coherent experience.'
            )}
          </p>
        </div>

        <div className="mt-20 space-y-24 sm:space-y-28">
          {showcases.map((s, i) => (
            <Showcase key={s.id} index={i} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase({ index, kicker, title, body, visual, accent }: any) {
  const reversed = index % 2 === 1;
  const accents: Record<string, string> = {
    sky: 'text-sky-600 dark:text-sky-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    violet: 'text-violet-600 dark:text-violet-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400'
  };
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <div>
        <p className={`text-xs font-semibold uppercase tracking-widest ${accents[accent]}`}>{kicker}</p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </p>
      </div>
      <div className="relative">
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-slate-100 to-transparent opacity-60 blur-2xl dark:from-slate-900" />
        <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          {visual}
        </div>
      </div>
    </div>
  );
}

/* ---------- visual mockups ---------- */

function VisualPlan({ routes }: any) {
  const first = routes[0] ?? { code: 'R1', name_en: 'Nyabugogo – Kimironko', name_rw: 'Nyabugogo – Kimironko', color_hex: '#0ea5e9' };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">From</p>
          <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">Nyabugogo</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">To</p>
          <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-white">Kimironko</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: first.color_hex }}>
            {first.code}
          </span>
          <span className="text-xs font-medium text-slate-900 dark:text-white">Direct</span>
          <span className="ml-auto text-[11px] text-slate-500">~21 min · 850 RWF</span>
        </div>
        <ol className="mt-2 space-y-1 text-[11px] text-slate-500">
          <li>Board at Nyabugogo</li>
          <li>Ride 4 stops</li>
          <li>Alight at Kimironko</li>
        </ol>
      </div>

      <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center dark:border-slate-700">
        <p className="text-[11px] text-slate-400">Demonstration fare formula shown</p>
      </div>
    </div>
  );
}

function VisualTrack({ vehicles, stops }: any) {
  return (
    <div className="space-y-3">
      <div className="aspect-[16/10] overflow-hidden rounded-xl">
        <MiniFleetMap vehicles={vehicles} stops={stops} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <InfoTile label="Live now" value={vehicles.length} tone="sky" />
        <InfoTile label="GPS" value={vehicles.filter((v: any) => !v.simulated).length} tone="emerald" />
        <InfoTile label="Sim" value={vehicles.filter((v: any) => v.simulated).length} tone="amber" />
      </div>
    </div>
  );
}

function InfoTile({ label, value, tone }: { label: string; value: any; tone: 'sky' | 'emerald' | 'amber' }) {
  const c = { sky: 'text-sky-600 dark:text-sky-400', emerald: 'text-emerald-600 dark:text-emerald-400', amber: 'text-amber-600 dark:text-amber-400' }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[9px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${c}`}>{value}</p>
    </div>
  );
}

function VisualML() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-900 dark:text-white">Model</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          GradientBoostingRegressor
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {[
          ['distance_remaining_m', '3200'],
          ['recent_speed_kmh', '18.0'],
          ['remaining_stops', '4'],
          ['delay_indicator', '0.30'],
          ['hour_of_day', '08'],
          ['day_of_week', '2']
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <p className="truncate font-mono text-[10px] text-slate-400">{k}</p>
            <p className="font-mono text-xs text-slate-900 dark:text-white">{v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/60 dark:bg-violet-950/30">
        <p className="text-[10px] uppercase tracking-wider text-violet-600 dark:text-violet-400">Predicted</p>
        <p className="mt-0.5 text-2xl font-bold text-violet-700 dark:text-violet-300">
          839 <span className="text-sm font-normal">seconds</span>
        </p>
        <p className="mt-1 text-[10px] text-violet-600/80 dark:text-violet-400/80">~ 13 min 59 s · model v1.0.0</p>
      </div>
    </div>
  );
}

function VisualTicket() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 p-4 text-white">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">RouteView ticket</p>
        <p className="mt-2 font-mono text-xs tracking-widest text-emerald-300">RT-A4B8C2D1F9</p>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-slate-400">R1 · Nyabugogo → Kimironko</p>
            <p className="mt-0.5 text-sm font-medium">14:30 today</p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">ISSUED</span>
        </div>
      </div>
      <div className="flex justify-center rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
        <div className="grid h-24 w-24 grid-cols-8 gap-px bg-slate-900 p-1 dark:bg-white">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className={`${(i * 7 + 3) % 3 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-900 dark:bg-white'}`} />
          ))}
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-400">Present this QR to an operator for validation</p>
    </div>
  );
}

function VisualAI() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        Nifasha kugera Kimironko nte?
      </div>
      <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-slate-800 dark:bg-sky-950/40 dark:text-slate-200">
        <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" /> Tools called
        </p>
        <div className="space-y-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
          <p>· find_stops(&quot;Kimironko&quot;)</p>
          <p>· plan_journey(from, to)</p>
          <p>· fare_between(route, from, to)</p>
        </div>
        <p className="mt-2 text-xs text-slate-800 dark:text-slate-200">
          Fata R1 ku Nyabugogo. Ugera Kimironko mu minota ~21. Igiciro: 850 RWF.
        </p>
      </div>
      <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-700 dark:bg-slate-800">
        {lang_is_rw_placeholder ? 'Andika…' : 'Type a message…'}
      </div>
    </div>
  );
}

const lang_is_rw_placeholder = true;