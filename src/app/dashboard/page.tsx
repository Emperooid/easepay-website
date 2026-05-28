'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDashboardHome } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { Plus, Minus, Wallet, Building2 } from 'lucide-react';

function HealthGauge({ score }: { score: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const label = score >= 80 ? 'Excellent!' : score >= 60 ? 'Strong!' : score >= 40 ? 'Fair' : 'Weak';
  const color = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-10 h-10 shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="20" cy="20" r={radius} fill="none"
            stroke={color} strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700">
          {score}%
        </span>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">Business Health</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: homeData } = useQuery({ queryKey: ['dashboard-home'], queryFn: getDashboardHome });

  const home = ((homeData?.data as any)?.data || homeData?.data || homeData || {}) as any;
  const netProfit = home?.netProfit || home?.todayProfit || home?.profit || home?.todayRevenue || 0;
  const cashInHand = home?.cashInHand || home?.cashBalance || home?.cash || 0;
  const bankBalance = home?.bankBalance || home?.moneyInBank || home?.bank || 0;
  const healthScore = home?.businessHealthScore || home?.healthScore || home?.score || 60;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <p className="text-base font-medium text-gray-900">
        👋{' '}
        <span className="text-teal-500 font-semibold">
          Hello {user?.businessName || user?.firstName || 'there'}
        </span>{' '}
        Welcome back to EasePay
      </p>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Profit */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">₦</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(netProfit)}</p>
              <p className="text-xs text-gray-400">Today's Profit</p>
            </div>
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(cashInHand)}</p>
              <p className="text-xs text-gray-400">Cash in Hand</p>
            </div>
          </div>
        </div>

        {/* Money in Bank */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Building2 size={15} className="text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{formatCurrency(bankBalance)}</p>
              <p className="text-xs text-gray-400">Money in Bank</p>
            </div>
          </div>
        </div>

        {/* Business Health */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <HealthGauge score={healthScore} />
        </div>
      </div>

      {/* Actions */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Actions</p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard/invoices/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus size={15} />
            Create New Invoice
          </Link>
          <button
            onClick={() => router.push('/dashboard/expenses')}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-800 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Minus size={15} />
            Add Expense
          </button>
        </div>
      </div>
    </div>
  );
}
