import './globals.css';
import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { ConfirmProvider } from '@/components/Confirm';
import Header from '@/components/Header';
import ChatDock from '@/components/ChatDock';

export const metadata: Metadata = {
  title: {
    default: 'RouteView — Kigali public transport, reimagined',
    template: '%s · RouteView'
  },
  description:
    'Plan journeys, track buses live, book digital tickets, and get AI-assisted travel help across Kigali.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="rw">
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <I18nProvider>
          <AuthProvider>
            <ConfirmProvider>
              <Header />
              <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
              <ChatDock />
            </ConfirmProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}