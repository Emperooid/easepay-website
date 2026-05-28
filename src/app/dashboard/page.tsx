'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getDashboardHome, getSales, getExpenses } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Minus, Wallet, Building2, TrendingUp, ArrowRight, ShoppingCart, Receipt } from 'lucide-react';

function HealthGauge({ score }: { score: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10 shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
          <circle cx="20" cy="20" r={radius} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
          {score}%
        </span>
      </div>
      <div>
        <p className="text-white text-sm font-bold">
          {score >= 80 ? 'Excellent' : score >= 60 ? 'Strong' : score >= 40 ? 'Fair' : 'Weak'}
        </p>
        <p className="text-white/50 text-xs">Business Health</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: homeData } = useQuery({ queryKey: ['dashboard-home'], queryFn: getDashboardHome });
  const { data: salesData } = useQuery({ queryKey: ['sales', { limit: 5 }], queryFn: () => getSales({ limit: 5 }) });
  const { data: expData } = useQuery({ queryKey: ['expenses', { limit: 5 }], queryFn: () => getExpenses({ limit: 5 }) });

  const home = ((homeData?.data as any)?.data || homeData?.data || homeData || {}) as any;
  const netProfit = home?.netProfit || home?.todayProfit || home?.profit || home?.todayRevenue || 0;
  const cashInHand = home?.cashInHand || home?.cashBalance || home?.cash || 0;
  const bankBalance = home?.bankBalance || home?.moneyInBank || home?.bank || 0;
  const healthScore = home?.businessHealthScore || home?.healthScore || home?.score || 0;

  const recentSales = ((salesData?.data as any)?.sales || (salesData as any)?.sales || salesData?.data || []).slice(0, 4);
  const recentExpenses = ((expData?.data as any)?.expenses || (expData as any)?.expenses || expData?.data || []).slice(0, 2);

  // Merge and sort by date desc
  const recent = [
    ...recentSales.map((s: any) => ({ ...s, _type: 'sale' })),
    ...recentExpenses.map((e: any) => ({ ...e, _type: 'expense' })),
  ]
    .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())
    .slice(0, 5);

  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="bg-[#050A30] rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-1/2 w-20 h-20 bg-blue-500/10 rounded-full translate-y-6" />
        <div className="relative">
          <p className="text-white/50 text-xs mb-1">{today}</p>
          <h1 className="text-white text-lg font-bold leading-tight">
            Hello, {user?.firstName || 'there'} 👋
          </h1>
          <p className="text-white/60 text-xs mt-0.5">
            {user?.businessName ? `Welcome back to ${user.businessName}` : 'Welcome back to EasePay'}
          </p>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold">Today's Profit</p>
              <p className="text-white text-2xl font-bold mt-0.5">{formatCurrency(netProfit)}</p>
            </div>
            <HealthGauge score={healthScore} />
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wallet size={14} className="text-emerald-600" />
            </div>
            <span className="text-xs text-gray-400 font-medium">Cash in Hand</span>
          </div>
          <p className="text-gray-900 text-base font-bold">{formatCurrency(cashInHand)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={14} className="text-blue-600" />
            </div>
            <span className="text-xs text-gray-400 font-medium">Money in Bank</span>
          </div>
          <p className="text-gray-900 text-base font-bold">{formatCurrency(bankBalance)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/dashboard/sales"
            className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200 hover:border-[#050A30]/30 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Plus size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Record Sale</p>
              <p className="text-[11px] text-gray-400">Add a new sale</p>
            </div>
          </Link>
          <Link href="/dashboard/expenses"
            className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200 hover:border-[#050A30]/30 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <Minus size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Add Expense</p>
              <p className="text-[11px] text-gray-400">Log an expense</p>
            </div>
          </Link>
          <Link href="/dashboard/invoices/new"
            className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200 hover:border-[#050A30]/30 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <TrendingUp size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">New Invoice</p>
              <p className="text-[11px] text-gray-400">Create & send</p>
            </div>
          </Link>
          <Link href="/dashboard/stock"
            className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200 hover:border-[#050A30]/30 hover:shadow-sm transition-all group">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <Building2 size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">View Stock</p>
              <p className="text-[11px] text-gray-400">Manage inventory</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Recent Activity</p>
            <Link href="/dashboard/sales" className="flex items-center gap-1 text-xs text-[#050A30] font-semibold hover:underline">
              See all <ArrowRight size={11} />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
            {recent.map((item: any, i: number) => {
              const isSale = item._type === 'sale';
              return (
                <div key={item.id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSale ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isSale
                      ? <ShoppingCart size={13} className="text-green-600" />
                      : <Receipt size={13} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {isSale ? (item.customerName || 'Walk-in customer') : (item.description || item.category || 'Expense')}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(item.createdAt || item.date)}</p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${isSale ? 'text-green-600' : 'text-red-500'}`}>
                    {isSale ? '+' : '-'}{formatCurrency(item.amount || item.grandTotal || 0)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
