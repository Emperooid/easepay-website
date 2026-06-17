'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { verifySubscriptionPayment } from '@/services/apiService';
import { useSubscription } from '@/context/SubscriptionContext';

type State = 'verifying' | 'success' | 'failed';

function PaymentCallbackContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { refresh }  = useSubscription();
  const [state, setState] = useState<State>('verifying');
  const [message, setMessage]   = useState('');
  const [planName, setPlanName] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const tx_ref         = params.get('tx_ref') ?? sessionStorage.getItem('pendingTxRef') ?? '';
    const transaction_id = params.get('transaction_id') ?? '';
    const flw_status     = params.get('status') ?? '';
    const storedPlan     = sessionStorage.getItem('pendingPlan') ?? '';

    sessionStorage.removeItem('pendingTxRef');
    sessionStorage.removeItem('pendingPlan');
    sessionStorage.removeItem('pendingInterval');

    setPlanName(storedPlan);

    if (flw_status === 'cancelled') {
      setState('failed');
      setMessage('Payment was cancelled. You were not charged.');
      return;
    }

    if (!tx_ref && !transaction_id) {
      setState('failed');
      setMessage('No payment reference found. If you were charged, please contact support.');
      return;
    }

    (async () => {
      try {
        const res: any = await verifySubscriptionPayment({ transaction_id, tx_ref });
        if (res?.success || res?.status === 'success' || res?.data?.status === 'active') {
          await refresh();
          setState('success');
          setMessage(res?.message ?? `Your ${storedPlan || 'subscription'} is now active!`);
          setTimeout(() => router.replace('/dashboard/settings/subscription'), 3000);
        } else {
          setState('failed');
          setMessage(res?.message ?? 'Payment verification failed. Contact support if you were charged.');
        }
      } catch (e: any) {
        setState('failed');
        setMessage(e?.message ?? 'Something went wrong during verification. Please contact support.');
      }
    })();
  }, [params, refresh, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center space-y-5">
        {state === 'verifying' && (
          <>
            <div className="flex justify-center">
              <Loader2 size={48} className="text-[#050A30] animate-spin" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Verifying Payment</p>
              <p className="text-sm text-gray-500 mt-1">Please wait while we confirm your subscription…</p>
            </div>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={34} className="text-green-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Payment Successful!</p>
              {planName && <p className="text-sm text-gray-500 mt-1">{planName} plan activated</p>}
              <p className="text-sm text-gray-500 mt-1">{message}</p>
              <p className="text-xs text-gray-400 mt-3">Redirecting to your subscription…</p>
            </div>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle size={34} className="text-red-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">Payment Failed</p>
              <p className="text-sm text-gray-500 mt-1">{message}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.replace('/dashboard/settings/subscription')}
                className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
                Back to Subscription
              </button>
              <a href="mailto:wecare@easetack.com"
                className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors block">
                Contact Support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={48} className="text-[#050A30] animate-spin" />
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
