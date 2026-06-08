'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  Home, Package, BarChart3, Activity, ShoppingCart,
  Receipt, FileText, Calculator, Building2, Settings, LogOut, X, Clock,
} from 'lucide-react';

const navGroups = [
  {
    items: [
      { href: '/dashboard', label: 'Home', icon: Home, exact: true },
      { href: '/dashboard/activity', label: 'All Activity', icon: Clock, exact: false },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { href: '/dashboard/sales', label: 'Sales', icon: ShoppingCart, exact: false },
      { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt, exact: false },
      { href: '/dashboard/invoices', label: 'Invoices', icon: FileText, exact: false },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/dashboard/stock', label: 'Stocks', icon: Package, exact: false },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, exact: true },
      { href: '/dashboard/business-health', label: 'Business Health', icon: Activity, exact: false },
      { href: '/dashboard/tax', label: 'Tax', icon: Calculator, exact: false },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/settings/business', label: 'Business', icon: Building2, exact: true },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: true },
    ],
  },
];

// Flat list for active check
const allNavItems = navGroups.flatMap(g => g.items);

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (item: typeof allNavItems[0]) => {
    if ((item as any).neverActive) return false;
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const avatarUrl = user?.avatar || user?.profileImage;
  const initials = user?.firstName?.[0]?.toUpperCase() || 'U';

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-30 w-52 bg-[#050A30] flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <img src="/logo-dark.png" alt="EasePay" className="h-20 w-auto" />
          <button onClick={onClose} className="lg:hidden text-white/50 hover:text-white p-1 rounded shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-none space-y-3">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-2 mb-1 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, ...item }) => {
                  const active = isActive({ href, label, icon: Icon, ...item });
                  return (
                    <Link
                      key={label}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-white/55 hover:text-white hover:bg-white/8'
                      )}
                    >
                      <Icon size={14} className={active ? 'text-white' : 'text-white/50'} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-white text-[9px] font-bold">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.firstName || 'User'}</p>
              <p className="text-white/40 text-[10px] truncate capitalize">{(user?.staffRole || user?.role || 'Owner').toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-white/8 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
