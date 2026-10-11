'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

export default function Header() {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Close mobile menu + lang dropdown when route changes
  useEffect(() => {
    setMenuOpen(false);
    setLangOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setLangOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isStaff = user && (user.role === 'operator' || user.role === 'admin');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">

        {/* ---------- Logo ---------- */}
        <Link
          href="/"
          aria-label="RouteView home"
          className="group flex flex-shrink-0 items-center gap-3 transition group-hover:opacity-90"
        >
          <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition group-hover:ring-sky-300 sm:h-12 sm:w-12 dark:bg-slate-900 dark:ring-slate-800 dark:group-hover:ring-sky-700">
            <Image
              src="/logo.png"
              alt="RouteView"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain p-1"
            />
          </span>
          <span className="hidden text-xl font-bold tracking-tight text-slate-900 sm:inline-block sm:text-2xl dark:text-white">
            Route<span className="bg-gradient-to-r from-sky-600 to-emerald-500 bg-clip-text text-transparent">View</span>
          </span>
        </Link>

        {/* ---------- Desktop navigation ---------- */}
        <nav className="hidden items-center gap-1 lg:flex">
          <NavItem href="/plan" active={pathname === '/plan'}>{t('nav.plan')}</NavItem>
          <NavItem href="/routes" active={pathname === '/routes' || pathname.startsWith('/routes/')}>{t('nav.routes')}</NavItem>
          <NavItem href="/map" active={pathname === '/map'}>{t('nav.map')}</NavItem>
          <NavItem href="/places" active={pathname === '/places'}>{t('nav.places')}</NavItem>
          <NavItem href="/tickets" active={pathname === '/tickets'}>{t('nav.tickets')}</NavItem>
        </nav>

        {/* ---------- Right side ---------- */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">

          {/* Staff / Console button */}
          {isStaff ? (
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h3" />
              </svg>
              <span>{t('nav.admin')}</span>
            </Link>
          ) : (
            <Link
              href="/admin/login"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>{t('nav.staff', 'Staff')}</span>
            </Link>
          )}

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
              <span>{lang.toUpperCase()}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => { setLang('rw'); setLangOpen(false); }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      lang === 'rw' ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>Kinyarwanda</span>
                    {lang === 'rw' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => { setLang('en'); setLangOpen(false); }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      lang === 'en' ? 'font-semibold text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>English</span>
                    {lang === 'en' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Sign in / Account */}
          {user ? (
            <button
              onClick={logout}
              className="hidden items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 sm:inline-flex dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold dark:bg-slate-900/15">
                {(user.full_name || 'U').slice(0, 1).toUpperCase()}
              </span>
              <span>{user.full_name?.split(' ')[0] || t('nav.account', 'Account')}</span>
            </button>
          ) : (
            <Link
              href="/tickets"
              className="hidden rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 sm:inline-flex dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {t('nav.signin', 'Sign in')}
            </Link>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ---------- Mobile drawer ---------- */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-[73px] z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute inset-x-0 top-full z-40 max-h-[calc(100vh-80px)] overflow-y-auto border-t border-slate-200 bg-white shadow-2xl lg:hidden dark:border-slate-800 dark:bg-slate-950">
            <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              {/* Primary links */}
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {t('nav.menu', 'Navigate')}
              </p>
              <ul className="space-y-1">
                <MobileItem href="/plan" icon={<PlanIcon />} active={pathname === '/plan'}>
                  {t('nav.plan')}
                </MobileItem>
                <MobileItem href="/routes" icon={<RoutesIcon />} active={pathname === '/routes' || pathname.startsWith('/routes/')}>
                  {t('nav.routes')}
                </MobileItem>
                <MobileItem href="/map" icon={<MapIcon />} active={pathname === '/map'}>
                  {t('nav.map')}
                </MobileItem>
                <MobileItem href="/places" icon={<PinIcon />} active={pathname === '/places'}>
                  {t('nav.places')}
                </MobileItem>
                <MobileItem href="/tickets" icon={<TicketIcon />} active={pathname === '/tickets'}>
                  {t('nav.tickets')}
                </MobileItem>
              </ul>

              {/* Staff section */}
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t('nav.staffArea', 'Staff area')}
                </p>
                {isStaff ? (
                  <MobileItem href="/admin" icon={<ConsoleIcon />} active={pathname.startsWith('/admin')}>
                    {t('nav.admin')}
                  </MobileItem>
                ) : (
                  <MobileItem href="/admin/login" icon={<ShieldIcon />} active={pathname === '/admin/login'}>
                    {t('nav.staffSignin', 'Staff sign-in')}
                  </MobileItem>
                )}
              </div>

              {/* Account section */}
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-900">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
                        {(user.full_name || 'U').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {user.full_name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {t('nav.signout', 'Sign out')}
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/tickets"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    {t('nav.signin', 'Sign in')}
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

/* ================================================================== *
 *  Nav items
 * ================================================================== */

function NavItem({
  href, active, children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 sm:-bottom-[17px]" />
      )}
    </Link>
  );
}

function MobileItem({
  href, icon, active, children
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
          active
            ? 'bg-gradient-to-r from-sky-50 to-emerald-50 text-sky-700 dark:from-sky-950/50 dark:to-emerald-950/30 dark:text-sky-300'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900'
        }`}
      >
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          active
            ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-900 dark:text-sky-400'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {icon}
        </span>
        <span className="flex-1">{children}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-300">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
    </li>
  );
}

/* ================================================================== *
 *  Icons
 * ================================================================== */

function PlanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="11" r="3" />
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
    </svg>
  );
}
function RoutesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M6 18 C 10 12, 14 12, 18 6" strokeDasharray="0 4" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11Z" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M13 6v2M13 10v2M13 14v2M13 18v0" />
    </svg>
  );
}
function ConsoleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}