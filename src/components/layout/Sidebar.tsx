'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  Home, Package, BarChart3, Activity, ShoppingCart,
  Receipt, FileText, Calculator, Building2, Settings, LogOut, X,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/sales', label: 'Sales', icon: ShoppingCart, exact: false },
  { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt, exact: false },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText, exact: false },
  { href: '/dashboard/stock', label: 'Stocks', icon: Package, exact: false },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, exact: true },
  { href: '/dashboard/reports', label: 'Business Health', icon: Activity, exact: false, neverActive: true },
  { href: '/dashboard/tax', label: 'Tax', icon: Calculator, exact: false },
  { href: '/dashboard/settings/business', label: 'Business Details', icon: Building2, exact: true },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: true },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (item: typeof navItems[0]) => {
    if (item.neverActive) return false;
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-56 bg-[#050A30] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <img src="/logo-dark.png" alt="EasePay" className="h-8 w-auto" />
          <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white ml-2">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, ...item }) => {
            const active = isActive({ href, label, icon: Icon, ...item });
            return (
              <Link
                key={label}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
