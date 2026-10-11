'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

const LINKS = [
  { href: '/admin',             label: 'Overview',        exact: true },
  { href: '/admin/bookings',    label: 'Bookings' },
  { href: '/admin/validate',    label: 'Validate ticket' },
  { href: '/admin/routes',      label: 'Routes' },
  { href: '/admin/stops',       label: 'Stops' },
  { href: '/admin/vehicles',    label: 'Vehicles' },
  { href: '/admin/alerts',      label: 'Alerts' },
  { href: '/admin/users',       label: 'Users' },
  { href: '/admin/status',      label: 'System status' }
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const isStaff = user && (user.role === 'operator' || user.role === 'admin');

  useEffect(() => {
    if (!loading && !isStaff) {
      const next = encodeURIComponent(path || '/admin');
      router.replace(`/admin/login?next=${next}`);
    }
  }, [loading, isStaff, path, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600 dark:border-slate-800 dark:border-t-sky-400" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 dark:text-amber-400" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
            <path d="M12 8v4M12 16v.01" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
          Staff access required
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Redirecting you to the staff sign-in page…
        </p>
        <Link
          href="/admin/login"
          className="mt-5 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
        >
          Open staff sign-in
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <aside className="md:sticky md:top-20 md:self-start">
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
              {(user?.full_name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {user?.full_name}
              </p>
              <p className="truncate text-[10px] uppercase tracking-widest text-slate-400">
                {user?.role}
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          {LINKS.map((l) => {
            const active = l.exact ? path === l.href : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-sky-600 font-medium text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => { logout(); router.push('/admin/login'); }}
          className="mt-3 block w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          Sign out
        </button>
      </aside>

      <section>{children}</section>
    </div>
  );
}