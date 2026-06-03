'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Menu, Bell, Settings, LogOut, Building2, X,
  CheckCheck, Check, ChevronDown, Crown,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/apiService';
import { formatDate } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  CASHIER: 'Cashier',
  ACCOUNTANT: 'Accountant',
};

const NOTIF_ICONS: Record<string, string> = {
  low_stock: '📦',
  staff_sale: '🛒',
  staff_invoice: '🧾',
  staff_expense: '💸',
  daily_reminder: '☀️',
  subscription_renewal: '👑',
  payment: '💰',
  default: '🔔',
};

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });

  const markAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const notifications: any[] = (notifData?.data as any)?.notifications || (notifData as any)?.notifications || notifData?.data || [];
  const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.isRead && !n.read).length : 0;

  const avatarUrl = user?.avatar || user?.profileImage;
  const initials = ((user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')).toUpperCase() || 'EP';
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const rawRole = (user?.role || '').toUpperCase();
  const rawStaffRole = (user?.staffRole || '').toUpperCase();
  const roleDisplay = ROLE_LABELS[rawRole] || ROLE_LABELS[rawStaffRole] || 'Owner';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-5 shrink-0 relative z-10">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu size={18} />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      {/* Right: bell + user */}
      <div className="flex items-center gap-1">

        {/* ─── Notifications ─── */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }}
            className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-bold text-gray-900">Notifications</p>
                  <p className="text-xs text-gray-400">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllMut.mutate()}
                      disabled={markAllMut.isPending}
                      className="flex items-center gap-1 text-[11px] text-[#050A30] font-semibold hover:underline disabled:opacity-50"
                    >
                      <CheckCheck size={11} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                    <X size={12} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {!Array.isArray(notifications) || notifications.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Bell size={26} className="mx-auto mb-2 opacity-25" />
                    <p className="text-xs">No notifications yet</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n: any) => {
                    const isUnread = !n.isRead && !n.read;
                    const emoji = NOTIF_ICONS[n.type] || NOTIF_ICONS.default;
                    return (
                      <button
                        key={n.id}
                        onClick={() => isUnread && markOneMut.mutate(n.id)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isUnread ? 'bg-blue-50/30' : ''}`}
                      >
                        <span className="text-base flex-shrink-0 mt-0.5 leading-none">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                            {n.message || n.title || n.body || 'Notification'}
                          </p>
                          {(n.createdAt || n.date) && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(n.createdAt || n.date)}</p>
                          )}
                        </div>
                        {isUnread && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* ─── User menu ─── */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Account menu"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#050A30] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-semibold text-gray-900 max-w-[90px] truncate">{displayName}</p>
              <p className="text-[10px] text-[#050A30] font-semibold">{roleDisplay}</p>
            </div>
            <ChevronDown size={12} className={`hidden sm:block text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-12 w-60 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
              {/* Profile card */}
              <div className="flex items-center gap-3 px-4 py-3.5 bg-gray-50 border-b border-gray-100">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#050A30] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                  <span className="inline-block text-[10px] font-semibold text-[#050A30] bg-[#050A30]/10 px-2 py-0.5 rounded-full mt-0.5">
                    {roleDisplay}
                  </span>
                  {user?.businessName && (
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{user.businessName}</p>
                  )}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  href="/dashboard/settings/business"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Building2 size={13} className="text-gray-400" />
                  <span>Business Profile</span>
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={13} className="text-gray-400" />
                  <span>Settings</span>
                </Link>
                <Link
                  href="/dashboard/settings/subscription"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Crown size={13} className="text-yellow-500" />
                  <span>Subscription</span>
                </Link>
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
