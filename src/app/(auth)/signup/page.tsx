'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Loader2, RefreshCw } from 'lucide-react';

type Step = 'form' | 'otp';

const COOLDOWN_SECS = 60;

export default function SignupPage() {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { sendOTP, verifyOTP, error, clearError } = useAuth();
  const router = useRouter();

  // Countdown ticker
  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCooldown(c => {
      if (c <= 1) { clearInterval(timerRef.current!); return 0; }
      return c - 1;
    }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldown]);

  const startCooldown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCooldown(COOLDOWN_SECS);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0 || loading) return;
    setLoading(true);
    const ok = await sendOTP(email, phone);
    setLoading(false);
    if (ok) {
      setOtp('');
      startCooldown();
      setStep('otp');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6 || loading) return;
    setLoading(true);
    const ok = await verifyOTP(email, phone, otp);
    setLoading(false);
    if (ok) router.replace('/onboarding');
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    const ok = await sendOTP(email, phone);
    setLoading(false);
    if (ok) { setOtp(''); startCooldown(); }
  };

  const handleBack = () => {
    clearError();
    setOtp('');
    // Don't go back to form — stay on OTP until verified or user manually navigates
    // Going back would re-show the form; block re-send via cooldown
    setStep('form');
  };

  if (step === 'otp') {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Verify your account</h2>
        <p className="text-gray-500 text-sm mb-6">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-gray-700">{email}</span>
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              autoFocus
              onChange={e => {
                clearError();
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                clearError();
                setOtp(pasted);
              }}
              placeholder="000000"
              maxLength={6}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-center tracking-[0.5em] text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#050A30] focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-gray-400 text-center">
              Enter the 6-digit code from your email
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Verifying…' : 'Verify OTP'}
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              className="flex items-center gap-1.5 text-sm font-medium text-[#050A30] hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={13} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Create your account</h2>
      <p className="text-gray-500 text-sm mb-6">Start managing your business with EasePay</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
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
          disabled={loading || cooldown > 0}
          className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Sending OTP…' : cooldown > 0 ? `Retry in ${cooldown}s` : 'Send OTP'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-[#050A30] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
