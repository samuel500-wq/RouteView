'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/* ================================================================== *
 *  Types                                                              *
 * ================================================================== */
type ScanResult = {
  ok: boolean;
  code: string;
  reference?: string;
  passenger_name?: string;
  route?: string;
  company?: string;
  departure_dt?: string;
  plate_number?: string;
  driver_name?: string;
  used_at?: string;
  redeemed_at?: string;
  reason?: string;
  ticket_type?: 'urban' | 'intercity';
  ts: number;
};

type Recent = ScanResult;

/* ================================================================== *
 *  Page                                                               *
 * ================================================================== */
export default function AdminValidatePage() {
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'running' | 'unsupported' | 'denied' | 'stopped'>('idle');
  const [plateNumber, setPlateNumber] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Load recent scans from localStorage ----
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('rv_validate_recent');
      if (raw) setRecent(JSON.parse(raw).slice(0, 20));
    } catch { /* ignore */ }
  }, []);

  // ---- Persist recent scans ----
  useEffect(() => {
    try {
      window.localStorage.setItem('rv_validate_recent', JSON.stringify(recent.slice(0, 20)));
    } catch { /* ignore */ }
  }, [recent]);

  // ---- Today's stats ----
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayScans = recent.filter((r) => new Date(r.ts).toDateString() === today);
    const accepted = todayScans.filter((r) => r.ok).length;
    const rejected = todayScans.filter((r) => !r.ok).length;
    return { total: todayScans.length, accepted, rejected };
  }, [recent]);

  // ---- Redeem a code ----
  const redeem = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Skip if the same code was just scanned <3s ago
    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === trimmed &&
      now - lastScanRef.current.ts < 3000
    ) {
      return;
    }
    lastScanRef.current = { code: trimmed, ts: now };

    setBusy(true);
    setResult(null);

    // Try intercity first, then urban.
    const isIntercityPayload = trimmed.startsWith('routeview://intercity/');

    let scan: ScanResult;

    const tryIntercity = async () => {
      const r = await api.intercityRedeem(trimmed, plateNumber || undefined);
      return {
        ok: true,
        code: r.code,
        reference: r.reference,
        passenger_name: r.passenger_name,
        route: r.route,
        company: r.company,
        departure_dt: r.departure_dt,
        plate_number: r.plate_number,
        driver_name: r.driver_name,
        used_at: r.used_at,
        ticket_type: 'intercity' as const,
        ts: Date.now()
      };
    };

    const tryUrban = async () => {
      const r = await api.redeemTicket(trimmed);
      return {
        ok: true,
        code: r.code,
        redeemed_at: r.redeemed_at,
        ticket_type: 'urban' as const,
        ts: Date.now()
      };
    };

    try {
      if (isIntercityPayload) {
        scan = await tryIntercity();
      } else {
        // Try intercity first as fallback for admin scans
        try {
          scan = await tryIntercity();
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (msg.includes('ticket_not_found')) {
            scan = await tryUrban();
          } else {
            throw e;
          }
        }
      }
    } catch (e: any) {
      const msg = String(e?.message || 'unknown_error');
      scan = {
        ok: false,
        code: trimmed,
        reason: msg,
        ticket_type: isIntercityPayload ? 'intercity' : undefined,
        ts: Date.now()
      };
    }

    setResult(scan);
    setRecent((prev) => [scan, ...prev].slice(0, 20));
    setBusy(false);
    setCode('');

    // Focus back on manual input for the next scan
    setTimeout(() => inputRef.current?.focus(), 200);

    // Auto-clear the result banner after 6 seconds
    setTimeout(() => {
      setResult((cur) => (cur && cur.ts === scan.ts ? null : cur));
    }, 6000);
  }, [plateNumber]);

  // ---- Start camera + barcode detection ----
  const startCamera = useCallback(async () => {
    if (cameraState === 'running' || cameraState === 'starting') return;

    if (!('BarcodeDetector' in window)) {
      setCameraState('unsupported');
      return;
    }

    setCameraState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraState('running');

      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ['qr_code'] });
      detectorRef.current = detector;

      const loop = async () => {
        const v = videoRef.current;
        if (!v || !detectorRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(v);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw) redeem(raw);
          }
        } catch { /* per-frame errors are ignored */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e: any) {
      setCameraState('denied');
    }
  }, [cameraState, redeem]);

  // ---- Stop camera ----
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    detectorRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  }, []);

  // ---- Auto-start camera on mount ----
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Enter key submits manual code ----
  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    redeem(code);
  }

  // ---- Clear the recent list ----
  function clearRecent() {
    setRecent([]);
    try { window.localStorage.removeItem('rv_validate_recent'); } catch {}
  }

  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('Genzura bileti', 'Validate ticket')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(
              'Soma QR code cyangwa wandike kode. Bileti yikoreshwa rimwe gusa.',
              'Scan a QR code or type the ticket reference. Each ticket is single-use.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/bookings"
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:text-slate-200">
            {t('Reba ingendo zose', 'View bookings')}
          </Link>
        </div>
      </header>

      {/* ---------- Today's stats ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={t('Byagenzuwe uyu munsi', 'Scanned today')}
          value={stats.total}
          tone="sky"
        />
        <StatTile
          label={t('Byemejwe', 'Accepted')}
          value={stats.accepted}
          tone="emerald"
        />
        <StatTile
          label={t('Byanze', 'Rejected')}
          value={stats.rejected}
          tone="rose"
        />
      </div>

      {/* ---------- Result banner ---------- */}
      {result && <ResultBanner result={result} onDismiss={() => setResult(null)} t={t} />}

      {/* ---------- Two-column layout ---------- */}
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ============ Scanner + manual entry ============ */}
        <div className="space-y-4">
          {/* Scanner card */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
                <CameraIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('Kamera', 'Camera scanner')}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <StatusDot state={cameraState} />
                  {cameraStateLabel(cameraState, t)}
                </p>
              </div>
              {cameraState === 'running' ? (
                <button
                  onClick={stopCamera}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                >
                  {t('Hagarika', 'Stop')}
                </button>
              ) : cameraState === 'idle' || cameraState === 'stopped' ? (
                <button
                  onClick={startCamera}
                  className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                >
                  {t('Tangira', 'Start')}
                </button>
              ) : null}
            </header>

            <div className="relative aspect-[4/3] w-full bg-slate-950">
              {/* Corner brackets */}
              <div className="pointer-events-none absolute inset-6 z-10">
                <Corner pos="tl" />
                <Corner pos="tr" />
                <Corner pos="bl" />
                <Corner pos="br" />
              </div>

              {/* Scan line */}
              {cameraState === 'running' && (
                <div className="pointer-events-none absolute inset-x-6 top-6 z-10 h-px bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-90">
                  <div className="rv-scan-line" />
                </div>
              )}

              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />

              {/* Overlay messages */}
              {cameraState !== 'running' && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-6 text-center backdrop-blur-sm">
                  <div className="max-w-xs">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                      <QrIcon />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-white">
                      {cameraStateHeadline(cameraState, t)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {cameraStateHelp(cameraState, t)}
                    </p>
                    {(cameraState === 'denied' || cameraState === 'idle' || cameraState === 'stopped') && (
                      <button
                        onClick={startCamera}
                        className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        {cameraState === 'denied'
                          ? t('Gerageza ukoreshe kamera', 'Try camera again')
                          : t('Tangira kamera', 'Start camera')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Plate number for intercity scans */}
            <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t('Nomero y’imodoka (bidategetswe)', 'Vehicle plate (optional)')}
                </span>
                <input
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="RAD 123 A"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <p className="mt-1.5 text-[10px] text-slate-400">
                {t(
                  'Iyi nomero izandikwa kuri bileti iyo yemejwe.',
                  'If provided, this plate is recorded on the ticket when redeemed.'
                )}
              </p>
            </div>
          </section>

          {/* Manual entry */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <KeyIcon />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('Kode y’ukoresha', 'Manual entry')}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t('Andika kode y’ubwiriza', 'Type the ticket reference or paste the QR payload')}
                </p>
              </div>
            </div>

            <form onSubmit={onManualSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('Urugero: a4b8c2d1f9h2', 'Example: a4b8c2d1f9h2')}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm tracking-wider dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={!code.trim() || busy}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-sky-600/20 transition hover:from-sky-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? t('Turagenzura…', 'Checking…') : t('Genzura', 'Validate')}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
              <HintPill label="routeview://intercity/…" />
              <HintPill label="routeview://ticket/…" />
              <HintPill label="24-char code" />
            </div>
          </section>
        </div>

        {/* ============ Recent scans ============ */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('Byagenzuwe vuba', 'Recent scans')}
              </p>
              <p className="text-[11px] text-slate-500">
                {t('Amasegonda 20 ashize', 'Last 20 validations')}
              </p>
            </div>
            {recent.length > 0 && (
              <button
                onClick={clearRecent}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                {t('Siba', 'Clear')}
              </button>
            )}
          </header>

          {recent.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <ClockIcon />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
                {t('Nta bileti yagenzuwe', 'No scans yet')}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  'Bileti uzemeza zizagaragara hano.',
                  'Validated tickets will appear here.'
                )}
              </p>
            </div>
          ) : (
            <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {recent.map((r) => (
                <li
                  key={`${r.ts}-${r.code}`}
                  className={`px-5 py-3 ${r.ok ? '' : 'bg-red-50/40 dark:bg-red-950/10'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      r.ok ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                           : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                    }`}>
                      {r.ok ? <CheckIcon /> : <XIcon />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-white">
                          {r.reference || r.code.slice(0, 14)}
                        </p>
                        <span className="flex-shrink-0 text-[10px] text-slate-400">
                          {timeAgo(r.ts)}
                        </span>
                      </div>
                      {r.ok ? (
                        <>
                          {r.passenger_name && (
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                              {r.passenger_name}
                            </p>
                          )}
                          {r.route && (
                            <p className="truncate text-[11px] text-slate-500">{r.route}</p>
                          )}
                          {r.company && (
                            <p className="truncate text-[10px] text-slate-400">
                              {r.company}{r.plate_number ? ` · ${r.plate_number}` : ''}
                            </p>
                          )}
                          {r.ticket_type === 'urban' && (
                            <p className="truncate text-[10px] text-slate-400">
                              {t('Bileti y’umujyi', 'Urban ticket')}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                          {humanReason(r.reason, t)}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---------- Inline CSS for scan line ---------- */}
      <style jsx global>{`
        @keyframes rv-scan {
          0%   { top: 0%; opacity: 1; }
          50%  { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 1; }
        }
        .rv-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #38bdf8, transparent);
          box-shadow: 0 0 12px #38bdf8;
          animation: rv-scan 3.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/* ================================================================== *
 *  Result banner                                                      *
 * ================================================================== */
function ResultBanner({ result, onDismiss, t }: { result: ScanResult; onDismiss: () => void; t: any }) {
  const palette = result.ok
    ? {
        bg: 'bg-gradient-to-br from-emerald-50 to-white',
        border: 'border-emerald-300',
        ring: 'ring-emerald-200/50',
        icon: 'bg-emerald-100 text-emerald-600',
        heading: 'text-emerald-900',
        body: 'text-emerald-800',
        label: t('Yemejwe', 'Accepted')
      }
    : {
        bg: 'bg-gradient-to-br from-red-50 to-white',
        border: 'border-red-300',
        ring: 'ring-red-200/50',
        icon: 'bg-red-100 text-red-600',
        heading: 'text-red-900',
        body: 'text-red-800',
        label: t('Yanzwe', 'Rejected')
      };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-2 ${palette.border} ${palette.bg} p-5 shadow-md ring-1 ${palette.ring} dark:bg-slate-900 dark:bg-none`}
    >
      <button
        onClick={onDismiss}
        className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="flex items-start gap-4">
        <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${palette.icon}`}>
          {result.ok ? <BigCheck /> : <BigX />}
        </span>

        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${palette.body}`}>
            {palette.label}
          </p>
          <p className={`mt-1 text-xl font-bold tracking-tight ${palette.heading} dark:text-white`}>
            {result.ok
              ? result.passenger_name || t('Bileti yemejwe', 'Ticket accepted')
              : humanReason(result.reason, t)}
          </p>
          {result.ok && result.route && (
            <p className={`mt-0.5 text-sm ${palette.body} dark:text-slate-300`}>{result.route}</p>
          )}
          {result.ok && result.reference && (
            <p className={`mt-0.5 font-mono text-xs ${palette.body} dark:text-slate-400`}>
              {result.reference}
            </p>
          )}
          {result.ok && result.company && (
            <p className={`mt-1 text-xs ${palette.body} dark:text-slate-400`}>
              {result.company}
              {result.plate_number && ` · ${result.plate_number}`}
              {result.driver_name && ` · ${result.driver_name}`}
            </p>
          )}
          {result.ok && result.departure_dt && (
            <p className={`mt-1 text-xs ${palette.body} dark:text-slate-400`}>
              {t('Igihe cyo gutangira', 'Departure')}: {new Date(result.departure_dt).toLocaleString()}
            </p>
          )}
          <p className={`mt-2 text-[10px] ${palette.body} dark:text-slate-500`}>
            {new Date(result.ts).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 *  Small pieces                                                       *
 * ================================================================== */
function StatTile({ label, value, tone }: { label: string; value: number; tone: 'sky' | 'emerald' | 'rose' }) {
  const tones = {
    sky: 'text-sky-600 dark:text-sky-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    rose: 'text-red-600 dark:text-red-400'
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const [vert, horiz] = pos.split('');
  const styles = 'absolute h-6 w-6 border-sky-400';
  const map: any = {
    tl: 'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
    tr: 'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
    bl: 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
    br: 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'
  };
  return <span className={`${styles} ${map[pos]}`} />;
}

function HintPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950">
      {label}
    </span>
  );
}

function StatusDot({ state }: { state: string }) {
  const cls =
    state === 'running' ? 'bg-emerald-500'
    : state === 'starting' ? 'bg-amber-500'
    : state === 'denied' || state === 'unsupported' ? 'bg-red-500'
    : 'bg-slate-400';
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls} ${state === 'starting' || state === 'running' ? 'animate-pulse' : ''}`} />
  );
}

/* ================================================================== *
 *  Copy helpers                                                       *
 * ================================================================== */
function cameraStateLabel(state: string, t: any) {
  switch (state) {
    case 'starting': return t('Turatanga kamera…', 'Starting camera…');
    case 'running': return t('Irakora · shyiramo QR', 'Scanning · point at a QR code');
    case 'denied': return t('Kamera yanzwe', 'Camera access denied');
    case 'unsupported': return t('Mudasobwa ntishyigikira QR scanner', 'Browser does not support QR scanning');
    case 'stopped': return t('Yahagaritswe', 'Camera stopped');
    default: return t('Irafunze', 'Camera idle');
  }
}

function cameraStateHeadline(state: string, t: any) {
  switch (state) {
    case 'starting': return t('Turatanga kamera…', 'Starting camera…');
    case 'denied': return t('Kamera yanzwe', 'Camera access denied');
    case 'unsupported': return t('Scanner ntaboneka', 'Scanner not available');
    case 'stopped': return t('Kamera yahagaritswe', 'Camera stopped');
    default: return t('Kamera irafunze', 'Camera is idle');
  }
}

function cameraStateHelp(state: string, t: any) {
  switch (state) {
    case 'denied':
      return t(
        'Emeza uruhushya rwa kamera muri browser kugira ngo ushobore gusoma QR.',
        'Enable camera access in your browser settings to scan QR codes.'
      );
    case 'unsupported':
      return t(
        'Koresha Chrome cyangwa Edge, cyangwa andika kode mu buryo bwa manuwe.',
        'Use Chrome or Edge, or type the ticket code manually.'
      );
    case 'stopped':
      return t('Kanda "Tangira" kugira ngo wongere gukoresha kamera.', 'Click Start to resume scanning.');
    default:
      return t(
        'Kanda "Tangira" kugira ngo utangire gusoma QR code.',
        'Click Start to begin scanning QR codes.'
      );
  }
}

function humanReason(reason: string | undefined, t: any): string {
  if (!reason) return t('Kode ntariyo', 'Invalid code');
  const map: Record<string, string> = {
    ticket_not_found: t('Bileti ntabonetse', 'Ticket not found'),
    already_used: t('Yamaze gukoreshwa', 'Already used'),
    already_redeemed: t('Yamaze gukoreshwa', 'Already used'),
    ticket_cancelled: t('Yahagaritswe', 'Ticket cancelled'),
    booking_cancelled: t('Ingendo yahagaritswe', 'Booking cancelled'),
    booking_refunded: t('Amafaranga yasubijwe', 'Booking refunded'),
    ticket_expired: t('Yarangiye', 'Ticket expired'),
    departed_expired: t('Igihe cyarenze', 'Departure window passed'),
    too_early: t('Biracyabuze igihe', 'Too early to scan'),
    invalid_type: t('Ubwoko butariyo', 'Invalid ticket type'),
    same_stop: t('Ahantu hamwe', 'Same origin and destination'),
    auth_required: t('Injira mbere', 'Sign in required'),
    forbidden: t('Nta ruhushya', 'Not authorised')
  };
  return map[reason] || reason;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/* ================================================================== *
 *  Icons                                                              *
 * ================================================================== */
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function QrIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v3M14 20h6" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="3" />
      <path d="M11 15h10M18 12v6M14 12v6" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function BigCheck() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function BigX() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}