'use client';

import { useSubscription } from '@/context/SubscriptionContext';
import { Crown, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function SubscriptionBanner() {
  const { status, tier, trialDaysLeft, isTrialExpired, gracePeriodEnd, expiresAt } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // ── Trial expiring soon (≤ 7 days left) ──────────────────────────────────────
  if (tier === 'FREE' && !isTrialExpired && trialDaysLeft !== null && trialDaysLeft <= 7) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown size={15} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            {trialDaysLeft === 0
              ? 'Your free trial ends today.'
              : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your free trial.`}{' '}
            <Link href="/dashboard/settings/subscription" className="underline font-semibold">Upgrade now</Link>
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-0.5 text-amber-500 hover:text-amber-700">
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Trial expired ─────────────────────────────────────────────────────────────
  if (isTrialExpired) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">
            Your free trial has ended. Upgrade to keep using EasePay.{' '}
            <Link href="/dashboard/settings/subscription" className="underline font-semibold">Choose a plan</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Grace period (payment failed) ─────────────────────────────────────────────
  if (status === 'GRACE' && gracePeriodEnd) {
    const days = Math.ceil((new Date(gracePeriodEnd).getTime() - Date.now()) / 86400000);
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-800 font-medium">
            Your payment failed.{' '}
            {days > 0 ? `You have ${days} day${days === 1 ? '' : 's'} to update your payment.` : 'Grace period has ended.'}{' '}
            <Link href="/dashboard/settings/subscription" className="underline font-semibold">Update now</Link>
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-0.5 text-orange-400 hover:text-orange-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Subscription expired ──────────────────────────────────────────────────────
  if (status === 'EXPIRED') {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">
            Your subscription has expired. Renew to restore full access.{' '}
            <Link href="/dashboard/settings/subscription" className="underline font-semibold">Renew now</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Cancelled — show access end date ─────────────────────────────────────────
  if (status === 'CANCELLED' && expiresAt) {
    const accessUntil = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={15} className="text-gray-500 flex-shrink-0" />
          <p className="text-xs text-gray-700 font-medium">
            Subscription cancelled. Full access until {accessUntil}.{' '}
            <Link href="/dashboard/settings/subscription" className="underline font-semibold">Reactivate</Link>
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 p-0.5 text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}
