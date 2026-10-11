'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoadingBox />}>
      <AdminLoginInner />
    </Suspense>
  );
}

function LoadingBox() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600 dark:border-slate-800 dark:border-t-sky-400" />
    </div>
  );
}

function AdminLoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, login, registerStaff, logout } = useAuth();
  const { lang } = useI18n();
  const t = (rw: string, en: string) => (lang === 'rw' ? rw : en);

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // If already signed in as staff, skip straight to the dashboard.
  // If signed in as a passenger, sign them out so they can log in as staff.
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (user.role === 'operator' || user.role === 'admin') {
      const next = params.get('next') || '/admin';
      router.replace(next);
    } else {
      // Passenger is signed in — clear and let them sign in as staff
      logout();
    }
  }, [user, loading, router, params, logout]);

  if (loading) return <LoadingBox />;

  return (
    <div className="relative min-h-[calc(100vh-80px)] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="relative grid min-h-[700px] lg:grid-cols-[1.1fr_1fr]">
        {/* Left: brand + story */}
        <div className="flex flex-col justify-between p-8 sm:p-12">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg">
              <ShieldMark />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">
                Route<span className="text-sky-400">View</span>
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Staff Console
              </p>
            </div>
          </div>

          <div className="max-w-lg">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {t('Ahantu h’abakozi gusa', 'Restricted area · staff only')}
            </span>

            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t('Gucunga ubwikorezi', 'Run the network')}
              <br />
              <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                {t('mu buryo bworoshye.', 'with confidence.')}
              </span>
            </h1>

            <p className="mt-5 text-base leading-relaxed text-slate-400">
              {t(
                'Ibikoresho byo gucunga ingendo, gukurikirana ibisi, kugenzura bileti, no gukora raporo — byose ahantu hamwe.',
                'Manage routes, monitor the fleet, validate tickets, and review analytics — all in one place.'
              )}
            </p>

            <ul className="mt-8 space-y-3.5">
              <Feature icon={<RouteIcon />} label={t('Gucunga ingendo n’ahantu', 'Manage routes and stops')} />
              <Feature icon={<BusSmallIcon />} label={t('Kurikirana ibisi ku ikarita', 'Track the fleet on the map')} />
              <Feature icon={<QrSmallIcon />} label={t('Kugenzura no gusoma bileti', 'Validate tickets and QR codes')} />
              <Feature icon={<ChartIcon />} label={t('Raporo n’ibarurishamari', 'Reports and analytics')} />
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span>{t('Umutekano', 'Security')}: JWT · bcrypt · RBAC</span>
            <span>{t('Uruhare', 'Role')}: operator / admin</span>
          </div>
        </div>

        {/* Right: form */}
        <div className="relative flex items-center justify-center border-l border-slate-800 bg-slate-900/60 p-6 backdrop-blur sm:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight">
                {mode === 'login'
                  ? t('Injira mu kibaho', 'Sign in to the console')
                  : t('Fungura konti y’umukozi', 'Create a staff account')}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {mode === 'login'
                  ? t('Ugomba kuba ufite konti y’umukoresha cyangwa umuyobozi.', 'You must have an operator or administrator account.')
                  : t('Ugomba kode y’ubutumire yatanzwe n’umuyobozi.', 'You need an invite code from an administrator.')}
              </p>
            </div>

            <div className="mb-6 flex rounded-full border border-slate-800 bg-slate-900 p-1">
              <TabButton active={mode === 'login'} onClick={() => setMode('login')}>
                {t('Injira', 'Sign in')}
              </TabButton>
              <TabButton active={mode === 'register'} onClick={() => setMode('register')}>
                {t('Konti nshya', 'Register')}
              </TabButton>
            </div>

            {mode === 'login' ? (
              <LoginForm onSubmit={login} t={t} />
            ) : (
              <RegisterForm onSubmit={registerStaff} t={t} />
            )}

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {t('Demo accounts', 'Demo accounts')}
              </p>
              <div className="mt-2 space-y-1.5 text-xs text-slate-400">
                <CredRow role="Operator" email="operator@routeview.rw" pwd="Password123!" />
                <CredRow role="Admin" email="admin@routeview.rw" pwd="Password123!" />
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              {t('Uri umugenzi?', 'Are you a passenger?')}{' '}
              <Link href="/tickets" className="font-semibold text-sky-400 hover:underline">
                {t('Kanda hano', 'Go here')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */

function LoginForm({ onSubmit, t }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('invalid_credentials')) {
        setErr(t('Email cyangwa ijambobanga sibyo.', 'Incorrect email or password.'));
      } else if (msg.includes('429')) {
        setErr(t('Ugerageza kenshi.', 'Too many attempts. Please wait.'));
      } else {
        setErr(t('Habaye ikibazo.', 'Something went wrong.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {err && <Alert>{err}</Alert>}

      <DarkField
        label={t('Email', 'Email')}
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@routeview.rw"
        autoComplete="email"
      />

      <DarkField
        label={t('Ijambobanga', 'Password')}
        type={showPwd ? 'text' : 'password'}
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        autoComplete="current-password"
        trailing={
          <button type="button" onClick={() => setShowPwd((v) => !v)}
            className="text-[11px] font-semibold text-slate-400 hover:text-white">
            {showPwd ? t('Hisha', 'Hide') : t('Erekana', 'Show')}
          </button>
        }
      />

      <button
        type="submit"
        disabled={busy || !email || password.length < 6}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy && <Spinner />}
        {busy ? t('Twinjira…', 'Signing in…') : t('Injira mu kibaho', 'Sign in to console')}
      </button>
    </form>
  );
}

function RegisterForm({ onSubmit, t }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'operator' | 'admin'>('operator');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    inviteCode.trim().length >= 4;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setBusy(true);
    try {
      await onSubmit({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role,
        invite_code: inviteCode.trim()
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('invalid_invite_code')) {
        setErr(t('Kode y’ubutumire ntariyo.', 'Invalid invite code.'));
      } else if (msg.includes('email_taken')) {
        setErr(t('Iyi email isanzwe.', 'Email is already registered.'));
      } else {
        setErr(t('Habaye ikibazo.', 'Something went wrong.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {err && <Alert>{err}</Alert>}

      <DarkField label={t('Amazina yombi', 'Full name')} value={fullName} onChange={setFullName} placeholder="Jean Bosco" />
      <DarkField label={t('Email', 'Email')} type="email" value={email} onChange={setEmail} placeholder="you@routeview.rw" />
      <DarkField label={t('Telefone (bidategetswe)', 'Phone (optional)')} type="tel" value={phone} onChange={setPhone} placeholder="+250 7XX XXX XXX" />
      <DarkField label={t('Ijambobanga', 'Password')} type="password" value={password} onChange={setPassword} placeholder={t('Nibura inyuguti 8', 'At least 8 characters')} />

      <div>
        <p className="text-xs font-medium text-slate-400">{t('Uruhare', 'Role')}</p>
        <div className="mt-2 flex gap-2">
          <RolePill selected={role === 'operator'} onClick={() => setRole('operator')}>Operator</RolePill>
          <RolePill selected={role === 'admin'} onClick={() => setRole('admin')}>Admin</RolePill>
        </div>
      </div>

      <DarkField
        label={t('Kode y’ubutumire', 'Invite code')}
        value={inviteCode}
        onChange={setInviteCode}
        placeholder="ROUTEVIEW2024"
      />

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy && <Spinner tone="dark" />}
        {busy ? t('Turakora…', 'Creating account…') : t('Fungura konti', 'Create staff account')}
      </button>
    </form>
  );
}

/* ================================================================== */

function TabButton({ active, onClick, children }: any) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition ${active ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

function RolePill({ selected, onClick, children }: any) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${selected ? 'border-sky-500 bg-sky-500/10 text-sky-300' : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'}`}>
      {children}
    </button>
  );
}

function DarkField({ label, type = 'text', value, onChange, placeholder, trailing, autoComplete }: any) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="mt-1.5 flex items-center rounded-xl border border-slate-800 bg-slate-950/60 transition focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600"
        />
        {trailing && <span className="pr-3">{trailing}</span>}
      </div>
    </label>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-red-900 bg-red-950/50 px-3.5 py-3 text-sm text-red-200">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
        <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

function CredRow({ role, email, pwd }: { role: string; email: string; pwd: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {role}
      </span>
      <code className="text-[11px]">{email}</code>
      <span className="text-slate-700">·</span>
      <code className="text-[11px]">{pwd}</code>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sky-400">
        {icon}
      </span>
      <span className="text-sm text-slate-300">{label}</span>
    </li>
  );
}

function Spinner({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const border = tone === 'dark' ? 'border-slate-900/30 border-t-slate-900' : 'border-white/30 border-t-white';
  return <span className={`h-4 w-4 animate-spin rounded-full border-2 ${border}`} />;
}

function ShieldMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" />
      <path d="M6 18 C 10 12, 14 12, 18 6" strokeDasharray="0 4" />
    </svg>
  );
}
function BusSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10H4V6Z" />
      <path d="M4 12h16M8 20v-2M16 20v-2" />
    </svg>
  );
}
function QrSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v3M14 20h6" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m7 14 3-3 4 4 5-6" />
    </svg>
  );
}