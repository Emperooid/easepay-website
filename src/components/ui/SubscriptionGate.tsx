'use client';

import { useState, useEffect } from 'react';
import { subscriptionExpiredEvent } from '@/services/apiService';
import { Crown, X } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    return subscriptionExpiredEvent.subscribe(() => setShow(true));
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-end mb-2">
          <button onClick={() => setShow(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#050A30] flex items-center justify-center mx-auto">
            <Crown size={24} className="text-yellow-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Subscription Required</h2>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
              Your trial or subscription has expired. Upgrade to continue using this feature.
            </p>
          </div>
          <Link
            href="/dashboard/settings/subscription"
            onClick={() => setShow(false)}
            className="block w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold hover:bg-[#0a1460] transition-colors text-center"
          >
            Upgrade Now
          </Link>
          <button onClick={() => setShow(false)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
