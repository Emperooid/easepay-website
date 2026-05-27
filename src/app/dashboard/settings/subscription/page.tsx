'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getMySubscription, getSubscriptionPlans, cancelSubscription } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2, CheckCircle, Crown, Zap } from 'lucide-react';
import { useState } from 'react';

export default function SubscriptionPage() {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const { data: statusData, isLoading: statusLoading } = useQuery({ queryKey: ['subscription'], queryFn: getMySubscription });
  const { data: plansData, isLoading: plansLoading } = useQuery({ queryKey: ['plans'], queryFn: getSubscriptionPlans });

  const cancelMut = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => setCancelled(true),
    onSettled: () => setCancelling(false),
  });

  const sub = (statusData?.data as any) || statusData;
  const plans = (plansData?.data as any)?.plans || plansData?.data || [];
  const isActive = sub?.status === 'ACTIVE' || sub?.active;
  const tier = sub?.tier || sub?.planName || 'FREE';

  if (statusLoading || plansLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Current Plan */}
      <div className={`rounded-xl border p-5 ${isActive ? 'bg-[#050A30] text-white border-[#050A30]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isActive ? <Crown size={20} className="text-yellow-300" /> : <Zap size={20} className="text-gray-400" />}
            <p className={`text-sm font-medium ${isActive ? 'text-white/70' : 'text-gray-500'}`}>Current Plan</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {isActive ? 'ACTIVE' : 'FREE'}
          </span>
        </div>
        <p className={`text-2xl font-bold ${isActive ? 'text-white' : 'text-gray-900'}`}>{tier}</p>
        {sub?.expiresAt && (
          <p className={`text-sm mt-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
            {isActive ? 'Renews' : 'Expires'} {formatDate(sub.expiresAt)}
          </p>
        )}
        {isActive && !cancelled && (
          <button
            onClick={() => { setCancelling(true); cancelMut.mutate(); }}
            disabled={cancelling}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {cancelling && <Loader2 size={14} className="animate-spin" />}
            Cancel Subscription
          </button>
        )}
        {cancelled && <p className="mt-3 text-sm text-white/70">Your subscription will end at the current billing period.</p>}
      </div>

      {/* Available Plans */}
      {plans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Plans</h3>
          <div className="space-y-3">
            {plans.map((plan: any) => (
              <div key={plan.id || plan.name} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-sm text-gray-500">{formatCurrency(plan.monthlyPrice || plan.price)}/month</p>
                  </div>
                  <a
                    href={`mailto:support@easepay.com?subject=Upgrade to ${plan.name}`}
                    className="px-4 py-2 bg-[#050A30] text-white text-sm font-medium rounded-lg hover:bg-[#0a1460] transition-colors"
                  >
                    Upgrade
                  </a>
                </div>
                {plan.features && (
                  <ul className="space-y-1.5">
                    {(Array.isArray(plan.features) ? plan.features : Object.entries(plan.features).filter(([, v]) => v).map(([k]) => k)).map((feature: any) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Payments are processed securely via Flutterwave. Contact support for billing questions.
      </p>
    </div>
  );
}
