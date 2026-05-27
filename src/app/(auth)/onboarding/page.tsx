'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/services/apiService';
import { Loader2 } from 'lucide-react';

const BUSINESS_TYPES = ['Retail', 'Food & Beverage', 'Fashion', 'Electronics', 'Health & Beauty', 'Services', 'Agriculture', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'POS'];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', businessName: '', businessType: '',
    businessAddress: '', paymentMethods: [] as string[], collectsVAT: false, hasStaff: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const toggle = (key: 'paymentMethods', val: string) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }));
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.businessName) return;
    setStep(2);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessType || form.paymentMethods.length === 0) {
      setError('Please select business type and at least one payment method');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await completeOnboarding({
        firstName: form.firstName,
        lastName: form.lastName,
        businessName: form.businessName,
        businessType: form.businessType,
        businessAddress: form.businessAddress,
        paymentMethods: form.paymentMethods,
        collectsVAT: form.collectsVAT,
        hasStaff: form.hasStaff,
      });
      if (res.success) {
        router.replace('/dashboard');
      } else {
        setError(res.message || 'Setup failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#050A30] rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">E</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your business</h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8 bg-[#050A30]' : s < step ? 'w-4 bg-[#050A30]/40' : 'w-4 bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Your details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                <input type="text" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Your business name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
                <input type="text" value={form.businessAddress} onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))} placeholder="Business address" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460]">
                Continue →
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleFinish} className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Business setup</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {BUSINESS_TYPES.map(type => (
                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, businessType: type }))}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${form.businessType === type ? 'bg-[#050A30] text-white border-[#050A30]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Methods Accepted</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <button key={method} type="button" onClick={() => toggle('paymentMethods', method)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${form.paymentMethods.includes(method) ? 'bg-[#050A30] text-white border-[#050A30]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'collectsVAT', label: 'I collect VAT from customers' },
                  { key: 'hasStaff', label: 'I have staff members' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="w-4 h-4 rounded accent-[#050A30]" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">← Back</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Setting up...' : 'Finish Setup'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
