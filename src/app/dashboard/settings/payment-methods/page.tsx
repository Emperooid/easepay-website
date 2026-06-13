'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Banknote, CreditCard, ArrowLeftRight, Info } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Same key as mobile AsyncStorage — no backend API needed
const STORAGE_KEY = 'payment_methods_config';

const DEFAULT_CONFIG = { cash: true, pos: true, transfer: true };

const METHODS = [
  { key: 'cash'     as const, label: 'Cash',          desc: 'Accept physical cash payments',         icon: Banknote,       color: 'text-green-600',  bg: 'bg-green-50'  },
  { key: 'pos'      as const, label: 'POS / Card',    desc: 'Accept card payments via POS terminal', icon: CreditCard,     color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'transfer' as const, label: 'Bank Transfer', desc: 'Accept payments via bank transfer',     icon: ArrowLeftRight, color: 'text-blue-600',   bg: 'bg-blue-50'   },
];

export default function PaymentMethodsPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  // Load from localStorage on mount — mirrors mobile loadConfig()
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConfig(JSON.parse(stored));
    } catch {}
  }, []);

  // Toggle + save instantly — mirrors mobile toggleMethod()
  const toggle = (key: keyof typeof DEFAULT_CONFIG) => {
    const updated = { ...config, [key]: !config[key] };
    if (!updated.cash && !updated.pos && !updated.transfer) {
      toast.error('At least one payment method must be enabled');
      return;
    }
    setConfig(updated);
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      toast.success('Saved');
    } catch {
      toast.error('Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Payment Methods</h1>
          <p className="text-xs text-gray-400">Choose which payment methods your business accepts</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 leading-relaxed">
        Enabled methods appear when creating invoices and recording sales.
      </p>

      {/* Method rows */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
        {METHODS.map(({ key, label, desc, icon: Icon, color, bg }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            </div>
            {/* Toggle switch — mirrors mobile Switch */}
            <button
              onClick={() => toggle(key)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${config[key] ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${config[key] ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        ))}
      </div>

      {saving && <p className="text-xs text-gray-400 text-center">Saving…</p>}

      {/* Info box */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Changes save instantly. At least one payment method must remain enabled.
        </p>
      </div>
    </div>
  );
}
