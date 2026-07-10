'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/apiService';
import { useState, useEffect } from 'react';
import {
  Building2, Users, CreditCard, ChevronRight, LogOut, Lock,
  Wallet, FileText, Download, Bell, Shield, HelpCircle,
  MessageSquare, Info, Package, Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SectionLink {
  href: string;
  icon: any;
  label: string;
  desc: string;
  badge?: string;
}

// Matches mobile's exact toggles
interface NotifState {
  pushNotifications: boolean;
  smsAlerts: boolean;
  lowStockAlert: boolean;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#050A30]' : 'bg-gray-200'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { isOwner } = usePermissions();

  const [notif, setNotif] = useState<NotifState>({ pushNotifications: true, smsAlerts: true, lowStockAlert: true });

  const { data } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  useEffect(() => {
    if (data) {
      const s = (data?.data || data) as any;
      setNotif({
        pushNotifications: s?.notificationsEnabled !== false,
        smsAlerts:         s?.smsAlerts         !== false,
        lowStockAlert:     s?.lowStockAlert      !== false,
      });
    }
  }, [data]);

  // Each toggle saves independently — same as mobile
  const toggleNotif = async (key: keyof NotifState) => {
    const newVal = !notif[key];
    setNotif(prev => ({ ...prev, [key]: newVal }));
    try {
      const payload: any =
        key === 'pushNotifications' ? { notificationsEnabled: newVal } :
        key === 'smsAlerts'         ? { smsAlerts: newVal } :
                                      { lowStockAlert: newVal };
      await updateSettings(payload);
    } catch {
      // revert on failure
      setNotif(prev => ({ ...prev, [key]: !newVal }));
      toast.error('Failed to save notification setting');
    }
  };

  const sections: { title: string; items: SectionLink[] }[] = [
    {
      title: 'Business',
      items: [
        { href: '/dashboard/settings/business', icon: Building2, label: 'Business Profile', desc: 'Update business info and branding' },
        { href: '/dashboard/settings/payment-methods', icon: CreditCard, label: 'Payment Methods', desc: 'Manage accepted payment types' },
        { href: '/dashboard/settings/input-balance', icon: Wallet, label: 'Set Balance', desc: 'Set cash in hand & bank balance' },
      ],
    },
    {
      title: 'Sales & Inventory',
      items: [
        { href: '/dashboard/settings/invoice-template', icon: FileText, label: 'Invoice Template', desc: 'Customize invoice appearance' },
        { href: '/dashboard/settings/import-data', icon: Download, label: 'Import Data', desc: 'Import products from CSV' },
        { href: '/dashboard/settings/categories', icon: Package, label: 'Item Categories', desc: 'Manage product categories' },
        { href: '/dashboard/settings/units', icon: Package, label: 'Measuring Units', desc: 'Manage units of measurement' },
      ],
    },
    ...(isOwner ? [{
      title: 'Team',
      items: [
        { href: '/dashboard/settings/staff', icon: Users, label: 'Manage Staff', desc: 'Invite team members and control what they can access' },
      ],
    }] : []),
    {
      title: 'Security',
      items: [
        { href: '/dashboard/settings/change-pin', icon: Lock, label: 'Change PIN', desc: 'Update your security PIN' },
        { href: '/dashboard/settings/subscription', icon: CreditCard, label: 'Subscription', desc: 'View and manage your plan', badge: user?.subscription?.planName || undefined },
      ],
    },
    ...(!isOwner ? [{
      title: 'My Access',
      items: [
        { href: '/dashboard/settings/roles', icon: Shield, label: 'My Permissions', desc: 'View your access level' },
      ],
    }] : []),
  ];

  const NOTIF_ITEMS: { key: keyof NotifState; label: string; desc: string }[] = [
    { key: 'pushNotifications', label: 'Push Notifications', desc: 'Real-time updates and alerts' },
    { key: 'smsAlerts',         label: 'SMS Alerts',         desc: 'Text message alerts (gateway pending)' },
    { key: 'lowStockAlert',     label: 'Low Stock Alert',    desc: 'When inventory runs low' },
  ];

  return (
    <div className="max-w-2xl space-y-6 pb-8 animate-in fade-in duration-200">
      {/* Profile Card */}
      <div className="bg-[#050A30] rounded-2xl p-4 flex items-center gap-3">
        {(user?.avatar || user?.profileImage) ? (
          <img src={user.avatar || user.profileImage} alt="Profile" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border-2 border-white/20" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {user?.firstName?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">{user?.firstName} {user?.lastName}</p>
          <p className="text-white/60 text-xs truncate">{user?.email || user?.phone}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block text-xs font-semibold px-2 py-0.5 bg-white/20 text-white rounded-full">{user?.role}</span>
            {user?.businessName && <span className="text-xs text-white/50 truncate">{user.businessName}</span>}
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      {sections.map(({ title, items }) => (
        <div key={title} className="space-y-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">{title}</p>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
            {items.map(({ href, icon: Icon, label, desc, badge }) => (
              <Link key={href} href={href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-[#050A30]/10 group-hover:text-[#050A30] transition-colors flex-shrink-0">
                    <Icon size={17} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      {badge && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">{badge}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Notifications — matches mobile's exact 3 toggles */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Notifications</p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {NOTIF_ITEMS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Bell size={16} className="text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              <Toggle on={notif[key]} onToggle={() => toggleNotif(key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Support & Legal — links to internal pages like mobile */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Support & Legal</p>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
          {[
            { href: '/dashboard/settings/help-center', icon: HelpCircle, label: 'Help Center', desc: 'Contact us & social links', external: false },
            { href: '/dashboard/settings/privacy-policy', icon: Info, label: 'Privacy Policy', desc: 'How we handle your data', external: false },
            { href: '/dashboard/settings/terms-of-service', icon: FileText, label: 'Terms of Service', desc: 'Rules for using EasePay', external: false },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link key={href} href={href} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-gray-200 transition-colors flex-shrink-0"><Icon size={17} /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* App version */}
      <div className="text-center">
        <p className="text-xs text-gray-300">EasePay Web · v1.0.0</p>
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="flex items-center gap-3 w-full px-4 py-3.5 bg-white rounded-xl border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 transition-all group">
        <div className="w-9 h-9 rounded-xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors flex-shrink-0">
          <LogOut size={17} className="text-red-500" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-red-600">Sign Out</p>
          <p className="text-xs text-red-400">Log out of your account</p>
        </div>
      </button>
    </div>
  );
}
