'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBalanceSettings, saveBalanceSettings } from '@/services/apiService';
import { ChevronLeft, Wallet, Building2, Loader2, CheckCircle2, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function InputBalancePage() {
  const [cash, setCash] = useState('');
  const [bank, setBank] = useState('');
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['balance-settings'], queryFn: getBalanceSettings });

  const saveMut = useMutation({
    mutationFn: () => saveBalanceSettings(parseFloat(cash) || 0, parseFloat(bank) || 0),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-home'] });
      toast.success('Balance updated!');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast.error('Failed to save balance'),
  });

  useEffect(() => {
    if (data) {
      const d = (data?.data || data) as any;
      setCash(String(d?.cashBalance ?? d?.cashInHand ?? ''));
      setBank(String(d?.bankBalance ?? ''));
    }
  }, [data]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>;

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Set Balance</h1>
          <p className="text-xs text-gray-400">Set your current cash and bank balances</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">This sets your starting balance. EasePay will automatically track changes based on your sales and expenses.</p>
      </div>

      <div className="space-y-4">
        {/* Cash in Hand */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Wallet size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Cash in Hand</p>
              <p className="text-xs text-gray-400">Physical cash available</p>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₦</span>
            <input type="number" value={cash} onChange={e => setCash(e.target.value)} min="0" step="0.01" placeholder="0.00"
              className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Building2 size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Money in Bank</p>
              <p className="text-xs text-gray-400">Balance in your bank account</p>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₦</span>
            <input type="number" value={bank} onChange={e => setBank(e.target.value)} min="0" step="0.01" placeholder="0.00"
              className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="bg-[#050A30] rounded-xl p-4 flex items-center justify-between">
        <p className="text-white/70 text-sm font-medium">Total Balance</p>
        <p className="text-white text-xl font-bold">₦{((parseFloat(cash) || 0) + (parseFloat(bank) || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
      </div>

      <div className="flex gap-3">
        <button onClick={() => { setCash('0'); setBank('0'); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          <RefreshCw size={14} /> Reset to Zero
        </button>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex-1 py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
          {saveMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : 'Save Balance'}
        </button>
      </div>
    </div>
  );
}
