'use client';

import { useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Lock, Loader2, CheckCircle2, Shield } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const BASE_URL = 'https://easepay-backend.onrender.com/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

export default function ChangePinPage() {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { toast.error('New PINs do not match'); return; }
    if (!/^\d+$/.test(newPin)) { toast.error('PIN must contain only digits'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/update-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPin, newPin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Failed to update PIN'); return; }
      setSuccess(true);
      toast.success('PIN updated successfully!');
    } catch { toast.error('Network error'); } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto py-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={44} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">PIN Updated!</h2>
          <p className="text-gray-500 mt-1">Your PIN has been changed successfully</p>
        </div>
        <Link href="/dashboard/settings" className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold text-center hover:bg-[#0a1460] transition-colors">
          Back to Settings
        </Link>
      </div>
    );
  }

  const PinField = ({ label, value, onChange, show, onToggle, placeholder }: any) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={placeholder}
          maxLength={6}
          inputMode="numeric"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#050A30] pr-12"
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Change PIN</h1>
          <p className="text-xs text-gray-400">Update your security PIN</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">Your PIN secures access to sensitive features. Use a PIN you can remember but others can't guess.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <PinField label="Current PIN" value={currentPin} onChange={setCurrentPin} show={showCurrent} onToggle={() => setShowCurrent(s => !s)} placeholder="••••" />
        <PinField label="New PIN" value={newPin} onChange={setNewPin} show={showNew} onToggle={() => setShowNew(s => !s)} placeholder="••••" />
        <PinField label="Confirm New PIN" value={confirmPin} onChange={setConfirmPin} show={showConfirm} onToggle={() => setShowConfirm(s => !s)} placeholder="••••" />

        {newPin && newPin === confirmPin && newPin.length >= 4 && (
          <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
            <CheckCircle2 size={14} /> PINs match
          </div>
        )}

        <button type="submit" disabled={loading || !currentPin || !newPin || !confirmPin}
          className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors mt-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Updating...</> : 'Update PIN'}
        </button>
      </form>
    </div>
  );
}
