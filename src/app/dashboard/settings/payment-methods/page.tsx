'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/services/apiService';
import { ChevronLeft, Banknote, CreditCard, ArrowLeftRight, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const METHODS = [
  { key: 'CASH', label: 'Cash', desc: 'Accept payments with physical cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { key: 'TRANSFER', label: 'Bank Transfer', desc: 'Accept payments via bank transfers', icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'POS', label: 'POS / Card', desc: 'Accept debit/credit card payments', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
];

export default function PaymentMethodsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ CASH: true, TRANSFER: true, POS: false });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const updateMut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => { toast.success('Payment methods saved'); setSaved(true); setTimeout(() => setSaved(false), 3000); },
    onError: () => toast.error('Failed to save'),
  });

  useEffect(() => {
    if (data) {
      const s = (data?.data || data) as any;
      const methods = s?.paymentMethods || s?.acceptedPaymentMethods;
      if (Array.isArray(methods)) {
        const map: Record<string, boolean> = { CASH: false, TRANSFER: false, POS: false };
        methods.forEach((m: string) => { if (map[m] !== undefined) map[m] = true; });
        setEnabled(map);
      }
    }
  }, [data]);

  const handleToggle = (key: string) => {
    const next = { ...enabled, [key]: !enabled[key] };
    const activeCount = Object.values(next).filter(Boolean).length;
    if (activeCount === 0) { toast.error('At least one payment method must be enabled'); return; }
    setEnabled(next);
  };

  const handleSave = () => {
    const paymentMethods = Object.entries(enabled).filter(([, v]) => v).map(([k]) => k);
    updateMut.mutate({ paymentMethods });
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>;

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Payment Methods</h1>
          <p className="text-xs text-gray-400">Choose which payment methods your business accepts</p>
        </div>
      </div>

      <div className="space-y-3">
        {METHODS.map(({ key, label, desc, icon: Icon, color, bg, border }) => (
          <div key={key} className={`bg-white rounded-xl border-2 p-4 transition-all ${enabled[key] ? `border-[#050A30]` : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${border} border`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              <button onClick={() => handleToggle(key)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled[key] ? 'bg-[#050A30]' : 'bg-gray-200'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled[key] ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">At least one payment method must remain enabled</p>

      <button onClick={handleSave} disabled={updateMut.isPending}
        className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
        {updateMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : 'Save Payment Methods'}
      </button>
    </div>
  );
}
