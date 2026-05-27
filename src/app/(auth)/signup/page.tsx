'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

type Step = 'form' | 'otp';

export default function SignupPage() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { sendOTP, verifyOTP, error, clearError } = useAuth();
  const router = useRouter();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await sendOTP(email, phone);
    setLoading(false);
    if (ok) setStep('otp');
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await verifyOTP(email, phone, otp);
    setLoading(false);
    if (ok) router.replace('/onboarding');
  };

  if (step === 'otp') {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Verify your account</h2>
        <p className="text-gray-500 text-sm mb-6">Enter the OTP sent to {email}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP Code</label>
            <input
              type="text"
              value={otp}
              onChange={e => { clearError(); setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); }}
              placeholder="Enter 6-digit OTP"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-widest text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:border-transparent"
              maxLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button type="button" onClick={() => setStep('form')} className="w-full text-sm text-gray-500 hover:text-gray-700">
            ← Back
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h2>
      <p className="text-gray-500 text-sm mb-6">Start managing your business with EasePay</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSendOTP} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => { clearError(); setEmail(e.target.value); }}
            placeholder="your@email.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => { clearError(); setPhone(e.target.value); }}
            placeholder="+234 800 000 0000"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-[#050A30] font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
