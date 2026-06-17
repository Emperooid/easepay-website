'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, CheckCircle2, Crown, Zap, Loader2, AlertTriangle } from 'lucide-react';
import { useSubscription, PLAN_DEFINITIONS, PlanDefinition } from '@/context/SubscriptionContext';
import { initializeSubscriptionPayment, cancelSubscription } from '@/services/apiService';
import toast from 'react-hot-toast';

type BillingInterval = 'MONTHLY' | 'YEARLY';

function formatNaira(n: number) {
  if (n === 0) return '₦0';
  return `₦${n.toLocaleString('en-NG')}`;
}

function yearSavings(plan: PlanDefinition) {
  const ifMonthly = plan.monthlyPrice * 12;
  if (!ifMonthly) return 0;
  return Math.round(((ifMonthly - plan.yearlyPrice) / ifMonthly) * 100);
}

export default function SubscriptionPage() {
  const { tier, status, planName, expiresAt, gracePeriodEnd, trialDaysLeft, isTrialExpired, refresh } = useSubscription();
  const [interval, setInterval] = useState<BillingInterval>('MONTHLY');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const isActive      = status === 'ACTIVE';
  const isGrace       = status === 'GRACE';
  const isCancelled   = status === 'CANCELLED';
  const expiryDateStr = expiresAt ? new Date(expiresAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpiringSoon = isActive && daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  const isPlanLocked   = isActive && !isExpiringSoon;

  const handleSubscribe = useCallback(async (plan: PlanDefinition) => {
    if (plan.tier === 'FREE') return;
    if (isPlanLocked) {
      toast.error(`Your ${planName} plan is active until ${expiryDateStr ?? 'billing period ends'}. You can renew within the last 7 days.`);
      return;
    }
    setPurchasing(plan.id);
    try {
      const CALLBACK_URL = `${window.location.origin}/payment-callback`;
      const initRes: any = await initializeSubscriptionPayment({
        planName: plan.name,
        interval: interval === 'YEARLY' ? 'yearly' : 'monthly',
        redirectUrl: CALLBACK_URL,
      });
      if (!initRes.success || !initRes.link) {
        toast.error(initRes.message ?? "We couldn't initialize payment. Please try again.");
        return;
      }
      // Store tx_ref so the callback page can verify
      sessionStorage.setItem('pendingTxRef', initRes.tx_ref ?? '');
      sessionStorage.setItem('pendingPlan',  plan.name);
      sessionStorage.setItem('pendingInterval', interval);
      // Redirect to Flutterwave
      window.location.href = initRes.link;
    } catch (e: any) {
      toast.error(e?.message ?? 'Payment error. Please try again.');
    } finally {
      setPurchasing(null);
    }
  }, [interval, isPlanLocked, planName, expiryDateStr]);

  const handleCancel = useCallback(async () => {
    if (!window.confirm(`Your ${planName} plan will remain active until ${expiryDateStr ?? 'the end of your billing period'}, then drop to Free. Are you sure you want to cancel?`)) return;
    setCancelling(true);
    try {
      const res: any = await cancelSubscription();
      if (res.success) {
        await refresh();
        toast.success(`${planName} plan cancelled. You keep access until ${expiryDateStr ?? 'the period ends'}.`);
      } else {
        toast.error(res.message ?? "Couldn't cancel. Please try again.");
      }
    } catch {
      toast.error("Cancellation failed. Please try again.");
    } finally {
      setCancelling(false);
    }
  }, [planName, expiryDateStr, refresh]);

  return (
    <div className="max-w-2xl space-y-5 pb-10 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Subscription</h1>
          <p className="text-xs text-gray-400">Manage your EasePay plan</p>
        </div>
      </div>

      {/* ── Current Plan Banner ── */}
      <div className={`rounded-xl p-5 ${isActive ? 'bg-[#050A30] text-white' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isActive ? <Crown size={18} className="text-yellow-300" /> : <Zap size={18} className="text-gray-400" />}
            <span className={`text-xs font-semibold ${isActive ? 'text-white/60' : 'text-gray-500'}`}>Current Plan</span>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isActive   ? 'bg-white/20 text-white' :
            isGrace    ? 'bg-orange-100 text-orange-700' :
            isCancelled? 'bg-red-100 text-red-700' :
                         'bg-gray-100 text-gray-600'
          }`}>
            {isActive ? 'ACTIVE' : isGrace ? 'GRACE PERIOD' : isCancelled ? 'CANCELLED' : 'FREE TRIAL'}
          </span>
        </div>
        <p className={`text-xl font-bold ${isActive ? 'text-white' : 'text-gray-900'}`}>{planName}</p>

        {isTrialExpired && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600 font-medium">Your free trial has ended. Subscribe to continue using EasePay.</p>
          </div>
        )}
        {trialDaysLeft !== null && trialDaysLeft > 0 && (
          <p className={`text-sm mt-1 ${isActive ? 'text-white/70' : 'text-amber-600'}`}>
            {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left in your free trial
          </p>
        )}
        {expiresAt && !isTrialExpired && (
          <p className={`text-sm mt-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
            {isActive ? 'Renews' : 'Expired'} {expiryDateStr}
          </p>
        )}
        {isGrace && gracePeriodEnd && (
          <p className="text-sm mt-1 text-orange-400">
            Grace period ends {new Date(gracePeriodEnd).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}
          </p>
        )}
        {isExpiringSoon && (
          <p className="text-sm mt-1 text-yellow-300">Expiring soon — you can renew or switch plans now.</p>
        )}

        {isActive && (
          <button onClick={handleCancel} disabled={cancelling}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
            {cancelling && <Loader2 size={14} className="animate-spin" />}
            Cancel Subscription
          </button>
        )}
      </div>

      {/* ── Billing Toggle ── */}
      {!isPlanLocked && (
        <div className="bg-white rounded-xl border border-gray-200 p-1 flex">
          {(['MONTHLY', 'YEARLY'] as BillingInterval[]).map(i => (
            <button key={i} onClick={() => setInterval(i)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${interval === i ? 'bg-[#050A30] text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {i === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              {i === 'YEARLY' && <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">12.5% off</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Plan Cards ── */}
      <div className="space-y-3">
        {PLAN_DEFINITIONS.map(plan => {
          const price       = interval === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
          const savings     = yearSavings(plan);
          const isCurrent   = tier === plan.tier;
          const isBuying    = purchasing === plan.id;

          return (
            <div key={plan.id}
              className={`bg-white rounded-xl border-2 p-5 transition-all ${
                plan.highlighted  ? 'border-[#050A30]' :
                isCurrent         ? 'border-green-400' :
                                    'border-gray-200'
              }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-gray-900">{plan.name}</p>
                    {plan.highlighted && <span className="text-[10px] font-bold bg-[#050A30] text-white px-2 py-0.5 rounded-full">POPULAR</span>}
                    {isCurrent && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">CURRENT</span>}
                  </div>
                  <p className="text-xs text-gray-400">{plan.description}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-lg font-bold text-gray-900">{formatNaira(price)}</p>
                  <p className="text-[11px] text-gray-400">/{interval === 'YEARLY' ? 'yr' : 'mo'}</p>
                  {interval === 'YEARLY' && savings > 0 && (
                    <p className="text-[10px] text-green-600 font-semibold">Save {savings}%</p>
                  )}
                </div>
              </div>

              <ul className="space-y-1.5 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.tier !== 'FREE' && (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isBuying || purchasing !== null || (isCurrent && isPlanLocked)}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isCurrent && isPlanLocked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.highlighted
                        ? 'bg-[#050A30] text-white hover:bg-[#0a1460]'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}>
                  {isBuying ? <><Loader2 size={14} className="animate-spin" /> Processing...</> :
                   isCurrent && isPlanLocked ? 'Current Plan' :
                   isCurrent && isExpiringSoon ? 'Renew Plan' :
                   `Subscribe — ${formatNaira(price)}/${interval === 'YEARLY' ? 'yr' : 'mo'}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Payments processed securely via Flutterwave. Contact{' '}
        <a href="mailto:wecare@easetack.com" className="text-[#3B82F6] underline">wecare@easetack.com</a> for billing questions.
      </p>
    </div>
  );
}
