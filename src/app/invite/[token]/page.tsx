'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { verifyInviteToken, acceptInvite } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import {
  Loader2, Mail, MailOpen, Eye, EyeOff, ShieldCheck, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface InviteData {
  email?: string;
  phone?: string;
  businessName?: string;
  roleName?: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = (params?.token as string) || '';
  const router = useRouter();
  const { setUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    (async () => {
      try {
        const res = await verifyInviteToken(token);
        if (res.success) {
          const data = (res.data || {}) as InviteData;
          setInviteData(data);
          setEmail(data.email || data.phone || '');
        } else {
          setInvalid(true);
          toast.error(res.message || 'This invitation link is no longer valid.');
        }
      } catch {
        setInvalid(true);
        toast.error('This invitation link is no longer valid.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!email || !firstName || !lastName || !password || !pin || pin.length !== 4) {
      toast.error('Fill in your name, email, password, and a 4-digit PIN to join the team.');
      return;
    }
    setSubmitting(true);
    try {
      const response: any = await acceptInvite({ token, email, firstName, lastName, password, pin });
      if (response.success) {
        const rawUser: any = { ...(response.user || {}) };
        if (!rawUser.permissions && rawUser.staffPermissions) rawUser.permissions = rawUser.staffPermissions;
        if (!rawUser.permissions && response.permissions) rawUser.permissions = response.permissions;
        if (!rawUser.permissions) rawUser.permissions = [];

        if (!rawUser.businessId) {
          rawUser.businessId = response.businessId || response.business?.id || rawUser.staffRoles?.[0]?.businessId || rawUser.staffRole?.businessId || null;
        }
        if (!rawUser.businessName) {
          rawUser.businessName = response.businessName || response.business?.name || inviteData?.businessName || null;
        }

        setUser(rawUser);
        toast.success(response.message || `You've successfully joined ${rawUser.businessName || 'the team'}!`);
        router.replace('/dashboard');
      } else {
        toast.error(response.message || "Something went wrong accepting your invite. Please try again.");
      }
    } catch {
      toast.error("Something went wrong accepting your invite. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3">
        <Loader2 className="animate-spin text-[#3B82F6]" size={28} />
        <p className="text-gray-500 text-sm">Verifying invitation...</p>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3 px-6 text-center">
        <Mail className="text-gray-300" size={40} />
        <h1 className="text-lg font-bold text-gray-900">Invitation Expired</h1>
        <p className="text-gray-500 text-sm max-w-sm">This invitation link is no longer valid. Ask your business owner to send a new invite.</p>
        <button onClick={() => router.replace('/login')} className="mt-3 px-5 py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-20 h-20 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mb-5">
            <MailOpen className="text-[#3B82F6]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You've been invited!</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Join <span className="text-[#3B82F6] font-semibold">{inviteData?.businessName || 'the team'}</span> as a{' '}
            <span className="text-[#3B82F6] font-semibold">{inviteData?.roleName || 'team member'}</span>
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3.5 py-1.5">
            <ShieldCheck size={14} className="text-[#3B82F6]" />
            <span className="text-xs font-semibold text-blue-700">{inviteData?.roleName || 'Staff Member'}</span>
          </div>
        </div>

        <h2 className="text-base font-bold text-gray-900">Complete your profile</h2>
        <p className="text-xs text-gray-400 mb-5">Fill in the details below to activate your account</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email / Phone</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="your@email.com"
              className="w-full px-3.5 py-3 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John"
                className="w-full px-3.5 py-3 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe"
                className="w-full px-3.5 py-3 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Create Password</label>
            <div className="relative">
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                className="w-full px-3.5 py-3 pr-10 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Create PIN</label>
            <p className="text-[11px] text-gray-400 mb-1.5">A 4-digit PIN for quick access</p>
            <div className="relative">
              <input
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                type={showPin ? 'text' : 'password'}
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
                className="w-full px-3.5 py-3 pr-10 border border-gray-200 bg-gray-50 rounded-xl text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              <button type="button" onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPin ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={submitting}
          className="w-full mt-7 py-3.5 bg-[#3B82F6] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors disabled:opacity-70"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <>Accept Invitation <ArrowRight size={18} /></>}
        </button>

        <p className="text-center text-[11px] text-gray-400 mt-5 leading-relaxed">
          By accepting, you agree to EasePay's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
