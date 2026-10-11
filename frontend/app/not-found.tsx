import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-semibold">404 — Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you were looking for does not exist in RouteView.
      </p>
      <Link href="/" className="mt-4 inline-block rounded-md bg-sky-600 px-4 py-2 text-sm text-white">
        Return home
      </Link>
    </div>
  );
}