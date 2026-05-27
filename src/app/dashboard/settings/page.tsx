'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Building2, Users, CreditCard, ChevronRight, User, LogOut } from 'lucide-react';

const sections = [
  { href: '/dashboard/settings/business', icon: Building2, label: 'Business Profile', desc: 'Update your business information' },
  { href: '/dashboard/settings/staff', icon: Users, label: 'Staff Management', desc: 'Manage team members and permissions' },
  { href: '/dashboard/settings/subscription', icon: CreditCard, label: 'Subscription', desc: 'View and manage your plan' },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#050A30] flex items-center justify-center text-white text-xl font-bold">
            {user?.firstName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email || user?.phone}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 bg-[#050A30]/10 text-[#050A30] rounded-full">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Settings Menu */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {sections.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-[#050A30]/10 group-hover:text-[#050A30] transition-colors">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-3 w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        <span className="text-sm font-medium">Sign Out</span>
      </button>
    </div>
  );
}
