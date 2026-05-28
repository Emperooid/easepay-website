'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/sales': 'Sales',
  '/dashboard/expenses': 'Expenses',
  '/dashboard/stock': 'Inventory',
  '/dashboard/invoices': 'Invoices',
  '/dashboard/invoices/new': 'New Invoice',
  '/dashboard/reports': 'Reports',
  '/dashboard/tax': 'Tax Summary',
  '/dashboard/settings': 'Settings',
  '/dashboard/settings/business': 'Business Profile',
  '/dashboard/settings/staff': 'Staff Management',
  '/dashboard/settings/subscription': 'Subscription',
  '/dashboard/settings/payment-methods': 'Payment Methods',
  '/dashboard/settings/input-balance': 'Set Balance',
  '/dashboard/settings/invoice-template': 'Invoice Template',
  '/dashboard/settings/import-data': 'Import Data',
  '/dashboard/settings/change-pin': 'Change PIN',
  '/dashboard/settings/roles': 'Roles & Permissions',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#050A30] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const title = pageTitles[pathname] ||
    (pathname.startsWith('/dashboard/transactions/') ? 'Transaction Details' : 'EasePay');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
