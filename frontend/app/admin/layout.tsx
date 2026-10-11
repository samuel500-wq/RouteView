'use client';
import { usePathname } from 'next/navigation';
import AdminShell from '@/components/AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  // The login page must render outside the AdminShell gate.
  if (path === '/admin/login') return <>{children}</>;

  return <AdminShell>{children}</AdminShell>;
}