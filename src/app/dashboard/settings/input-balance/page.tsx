'use client';

import { useState, useEffect } from 'react';
import { getBalanceSettings, saveBalanceSettings } from '@/services/apiService';
import { ChevronLeft, Wallet, Building2, Loader2, Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Same keys as mobile AsyncStorage
const CASH_KEY = 'starting_cash_balance';
const BANK_KEY = 'starting_bank_balance';

export default function InputBalancePage() {
  const [cash, setCash] = useState('');
  const [bank, setBank] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load — try backend first, fall back to localStorage (same as mobile)
  useEffect(() => {
    (async () => {
      try {
        const res = await getBalanceSettings().catch(() => null);
        if (res?.success && res.data) {
          const d = res.data as any;
          const c = String(d.cashBalance ?? d.cashInHand ?? '');
          const b = String(d.bankBalance ?? d.cashInBank ?? '');
          if (c && c !== '0') { setCash(c); localStorage.setItem(CASH_KEY, c); }
          if (b && b !== '0') { setBank(b); localStorage.setItem(BANK_KEY, b); }
        } else {
          // Fall back to localStorage cache
          const c = localStorage.getItem(CASH_KEY);
          const b = localStorage.getItem(BANK_KEY);
          if (c) setCash(c);
          if (b) setBank(b);
        }
      } catch {
        const c = localStorage.getItem(CASH_KEY);
        const b = localStorage.getItem(BANK_KEY);
        if (c) setCash(c);
        if (b) setBank(b);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    const cashVal = parseFloat(cash) || 0;
    const bankVal = parseFloat(bank) || 0;
    if (cashVal < 0 || bankVal < 0) { toast.error('Balances cannot be negative'); return; }

    setIsSaving(true);
    try {
      // Save to localStorage first (always works)
      localStorage.setItem(CASH_KEY, String(cashVal));
      localStorage.setItem(BANK_KEY, String(bankVal));
      // Best-effort backend sync
      await saveBalanceSettings(cashVal, bankVal).catch(() => {});
      toast.success('Balances saved!');
    } catch {
      toast.error('Failed to save balances');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Clear your starting cash and bank balances? Transaction history will not be affected.')) return;
    setCash('');
    setBank('');
    localStorage.removeItem(CASH_KEY);
    localStorage.removeItem(BANK_KEY);
    saveBalanceSettings(0, 0).catch(() => {});
    toast.success('Balances cleared');
  };

  const total = (parseFloat(cash) || 0) + (parseFloat(bank) || 0);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>;

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Input Balance</h1>
          <p className="text-xs text-gray-400">Set your current cash and bank balances</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed">
        Enter your current cash-in-hand and bank account balance. This will be added to amounts from your transactions and shown on your dashboard.
      </p>

      {/* Cash in Hand */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Cash in Hand</p>
            <p className="text-xs text-gray-400">Physical cash your business currently holds</p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₦</span>
          <input
            type="number" value={cash}
            onChange={e => setCash(e.target.value.replace(/[^0-9.]/g, ''))}
            min="0" step="1" placeholder="0"
            className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xl font-bold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:bg-white"
          />
        </div>
      </div>

      {/* Money in Bank */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Money in Bank</p>
            <p className="text-xs text-gray-400">Balance in your business bank account</p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">₦</span>
          <input
            type="number" value={bank}
            onChange={e => setBank(e.target.value.replace(/[^0-9.]/g, ''))}
            min="0" step="1" placeholder="0"
            className="w-full pl-10 pr-4 py-4 border border-gray-200 rounded-xl text-xl font-bold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:bg-white"
          />
        </div>
      </div>

      {/* Total */}
      <div className="bg-[#050A30] rounded-2xl p-5 flex items-center justify-between">
        <p className="text-white/60 text-sm font-medium">Total Balance</p>
        <p className="text-white text-2xl font-bold">₦{total.toLocaleString('en-NG')}</p>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          These are your starting balances. The app adds money from cash sales and deducts cash expenses on top of this figure to keep your dashboard current.
        </p>
      </div>

      {/* Reset */}
      <button onClick={handleReset}
        className="flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors w-full py-2">
        <RefreshCw size={14} /> Reset balances to zero
      </button>

      {/* Save */}
      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-4 bg-gray-900 text-white rounded-2xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
        {isSaving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Balances'}
      </button>
    </div>
  );
}
