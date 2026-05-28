'use client';

import { Menu, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '@/services/apiService';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { user } = useAuth();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60000,
  });

  const notifications = (notifData?.data as any)?.notifications || notifData?.data || [];
  const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => !n.isRead && !n.read).length : 0;

  const avatarUrl = user?.avatar || user?.profileImage;
  const initials = user?.firstName?.[0]?.toUpperCase() || 'U';
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const displayRole = user?.staffRole || user?.role || 'Manager';

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-5 shrink-0">
      <div className="flex items-center gap-2.5">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Menu size={18} />
        </button>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Notifications */}
        <button className="relative p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-gray-200" />

        {/* User */}
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#050A30] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
          )}
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-gray-900 leading-tight">{displayName}</p>
            <p className="text-[11px] text-gray-400 capitalize leading-tight">{displayRole.toLowerCase()}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
