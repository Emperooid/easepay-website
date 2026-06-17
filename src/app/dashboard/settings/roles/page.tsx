'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getCurrentUser } from '@/services/apiService';
import { CheckCircle2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const PERM_LABELS: Record<string, string> = {
  manage_sales: 'Record Sales',
  manage_invoices: 'Create Invoices',
  manage_expenses: 'Record Expenses',
  manage_stocks: 'View & Add Stock',
  view_transactions: 'Transaction History',
  view_reports: 'Financial Reports',
  view_tax: 'Tax Summary',
  export_data: 'Export Data',
  import_data: 'Import Stock',
  manage_business: 'Edit Business Profile',
  change_pin: 'Change Own PIN',
  biometric_auth: 'Enable Biometrics',
};

export default function MyPermissionsPage() {
  const { user, setUser } = useAuth();
  const { isOwner } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await getCurrentUser();
      if (res.success && res.user) {
        setUser(res.user);
        toast.success('Permissions refreshed');
      } else {
        toast.error("We couldn't refresh your permissions. Please try again.");
      }
    } catch {
      toast.error("We couldn't refresh your permissions. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  };

  if (isOwner) {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-24 text-center mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Users size={26} className="text-gray-400" />
        </div>
        <p className="text-gray-800 font-semibold">You're the business owner</p>
        <p className="text-gray-400 text-sm mt-1.5 max-w-xs">You have full access. To manage what staff can do, head to Staff Management.</p>
        <Link href="/dashboard/settings/staff" className="mt-4 text-sm text-[#3B82F6] font-medium hover:underline">Go to Staff Management</Link>
      </div>
    );
  }

  const permissions: string[] = user?.permissions ?? [];

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-base font-bold text-gray-900">My Permissions</h1>
        <p className="text-xs text-gray-400">What you're allowed to do on this business account</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <ShieldCheck size={15} className="text-gray-500" />
          <h3 className="text-sm font-bold text-gray-900">Your Access</h3>
        </div>
        {permissions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No permissions assigned yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {permissions.map(perm => (
              <div key={perm} className="flex items-center gap-3 px-5 py-3">
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800">{PERM_LABELS[perm] ?? perm}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full flex items-center justify-between px-5 py-3.5 border-t border-gray-100 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <span className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-gray-400' : 'text-gray-400'} />
            {refreshing ? 'Refreshing...' : 'Refresh Permissions'}
          </span>
        </button>
      </div>
    </div>
  );
}
