'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDashboardHome, getSales, getExpenses, getBalanceSettings, getInvoices, getInventory } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus, Minus, Wallet, Building2, TrendingUp, ArrowRight,
  ShoppingCart, Receipt, FileText, Package, ChevronRight, Loader2,
} from 'lucide-react';

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
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">{score}%</span>
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

function computeTodayProfit(allSales: any[], allExpenses: any[]): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const revenue = allSales
    .filter(s => new Date(s.createdAt || s.date || 0) >= todayStart)
    .reduce((sum, s) => sum + (parseFloat(s.amount) || parseFloat(s.total) || 0), 0);

  const expenses = allExpenses
    .filter(e => new Date(e.createdAt || e.date || 0) >= todayStart)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return revenue - expenses;
}

function computeBalances(
  sales: any[], invoices: any[], expenses: any[],
  startCash: number, startBank: number
) {
  let cash = startCash;
  let bank = startBank;

  for (const s of sales) {
    const val = parseFloat(s.amount || s.total || 0);
    const pm = (s.paymentMethod || 'transfer').toLowerCase();
    if (pm === 'cash') cash += val; else bank += val;
  }
  for (const inv of invoices) {
    const val = parseFloat(inv.grandTotal || inv.total || inv.amount || 0);
    const pm = (inv.paymentMethod || 'transfer').toLowerCase();
    if (pm === 'cash') cash += val; else bank += val;
  }
  for (const e of expenses) {
    const val = parseFloat(e.amount || 0);
    const pm = (e.paymentMethod || 'transfer').toLowerCase();
    if (pm === 'cash') cash -= val; else bank -= val;
  }

  return { cashInHand: Math.max(0, cash), bankBalance: Math.max(0, bank) };
}

const TYPE_CONFIG = {
  sale: { label: 'Sale', icon: ShoppingCart, bg: 'bg-green-50', color: 'text-green-600', amtColor: 'text-green-600', prefix: '+' },
  invoice: { label: 'Invoice', icon: FileText, bg: 'bg-blue-50', color: 'text-blue-600', amtColor: 'text-blue-600', prefix: '+' },
  expense: { label: 'Expense', icon: Receipt, bg: 'bg-red-50', color: 'text-red-500', amtColor: 'text-red-500', prefix: '-' },
  stock: { label: 'Stock', icon: Package, bg: 'bg-purple-50', color: 'text-purple-600', amtColor: 'text-gray-500', prefix: '' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [displayLimit, setDisplayLimit] = useState(20);

  const { data: homeData } = useQuery({ queryKey: ['dashboard-home'], queryFn: getDashboardHome });
  const { data: balanceData } = useQuery({ queryKey: ['balance-settings'], queryFn: getBalanceSettings });

  const home = ((homeData?.data as any)?.data || homeData?.data || homeData || {}) as any;
  const healthScore = home?.businessHealthScore || home?.healthScore || home?.score || 0;

  const { data: allSalesData } = useQuery({ queryKey: ['sales-all'], queryFn: () => getSales({ limit: 1000 }) });
  const { data: allInvData } = useQuery({ queryKey: ['invoices-all'], queryFn: () => getInvoices({ limit: 1000 }) });
  const { data: allExpData } = useQuery({ queryKey: ['expenses-all'], queryFn: () => getExpenses({ limit: 1000 }) });

  const { data: recentSalesData } = useQuery({ queryKey: ['sales-recent'], queryFn: () => getSales({ limit: 200 }) });
  const { data: recentExpData } = useQuery({ queryKey: ['expenses-recent'], queryFn: () => getExpenses({ limit: 200 }) });
  const { data: recentInvData } = useQuery({ queryKey: ['invoices-recent'], queryFn: () => getInvoices({ limit: 200 }) });
  const { data: recentStockData } = useQuery({ queryKey: ['inventory-recent'], queryFn: () => getInventory({ limit: 200 }) });

  const balRaw = (balanceData?.data || balanceData) as any;
  const startCash = parseFloat(String(balRaw?.cashBalance ?? balRaw?.cashInHand ?? 0)) || 0;
  const startBank = parseFloat(String(balRaw?.bankBalance ?? balRaw?.cashInBank ?? 0)) || 0;

  const allSales: any[] = (allSalesData?.data as any)?.sales || (allSalesData as any)?.sales || allSalesData?.data || [];
  const allInvoices: any[] = (allInvData?.data as any)?.invoices || (allInvData as any)?.invoices || allInvData?.data || [];
  const allExpenses: any[] = (allExpData?.data as any)?.expenses || (allExpData as any)?.expenses || allExpData?.data || [];

  // Today's profit: API first, computed fallback
  const apiProfit = home?.todayProfit ?? home?.todayRevenue ?? home?.netProfit;
  const todayProfit = typeof apiProfit === 'number' && apiProfit !== 0
    ? apiProfit
    : computeTodayProfit(allSales, allExpenses);

  const { cashInHand, bankBalance } = computeBalances(allSales, allInvoices, allExpenses, startCash, startBank);

  const recentSales: any[] = (recentSalesData?.data as any)?.sales || (recentSalesData as any)?.sales || recentSalesData?.data || [];
  const recentExpenses: any[] = (recentExpData?.data as any)?.expenses || (recentExpData as any)?.expenses || recentExpData?.data || [];
  const recentInvoices: any[] = (recentInvData?.data as any)?.invoices || (recentInvData as any)?.invoices || recentInvData?.data || [];
  const recentStock: any[] = (recentStockData?.data as any)?.items || (recentStockData as any)?.items || recentStockData?.data || [];

  const recent = [
    ...recentSales.map((s: any) => ({
      _key: `sale-${s.id}`, _type: 'sale' as const, _id: s.id,
      _ts: new Date(s.createdAt || s.date || 0).getTime(),
      label: s.customerName || 'Walk-in customer',
      subLabel: s.items?.map((i: any) => i.name).join(', ') || s.description || '',
      amount: parseFloat(s.amount || 0),
      paymentMethod: s.paymentMethod,
      date: s.createdAt || s.date,
    })),
    ...recentInvoices.map((inv: any) => ({
      _key: `inv-${inv.id}`, _type: 'invoice' as const, _id: inv.id,
      _ts: new Date(inv.createdAt || inv.invoiceDate || inv.date || 0).getTime(),
      label: inv.customerName || `Invoice #${inv.invoiceNumber || ''}`,
      subLabel: inv.invoiceNumber ? `#${inv.invoiceNumber}` : '',
      amount: parseFloat(inv.grandTotal || inv.total || inv.amount || 0),
      paymentMethod: inv.paymentMethod,
      date: inv.createdAt || inv.invoiceDate || inv.date,
      status: inv.status,
    })),
    ...recentExpenses.map((e: any) => ({
      _key: `exp-${e.id}`, _type: 'expense' as const, _id: e.id,
      _ts: new Date(e.createdAt || e.date || 0).getTime(),
      label: e.description || e.category || 'Expense',
      subLabel: e.category || '',
      amount: parseFloat(e.amount || 0),
      paymentMethod: e.paymentMethod,
      date: e.createdAt || e.date,
    })),
    ...recentStock.map((s: any) => ({
      _key: `stock-${s.id}`, _type: 'stock' as const, _id: s.id,
      _ts: new Date(s.createdAt || s.updatedAt || 0).getTime(),
      label: s.name || 'Inventory Item',
      subLabel: `${s.category || 'Stock'} · ${s.quantity ?? 0} units`,
      amount: (parseFloat(s.costPrice || s.cost || 0)) * (parseFloat(s.quantity || 1)),
      paymentMethod: undefined,
      date: s.createdAt || s.updatedAt,
    })),
  ]
    .sort((a, b) => b._ts - a._ts);

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
              <p className={`text-2xl font-bold mt-0.5 ${todayProfit < 0 ? 'text-red-400' : 'text-white'}`}>
                {formatCurrency(todayProfit)}
              </p>
            </div>
            {healthScore > 0 && <HealthGauge score={healthScore} />}
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
              <Package size={16} className="text-purple-600" />
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
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Recent Activity <span className="text-gray-300 font-normal normal-case">({recent.length})</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
            {recent.slice(0, displayLimit).map((item) => {
              const cfg = TYPE_CONFIG[item._type];
              const Icon = cfg.icon;
              const isClickable = item._type !== 'stock';
              const href = isClickable ? `/dashboard/transactions/${item._type}/${item._id}` : null;

              const content = (
                <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isClickable ? 'hover:bg-[#050A30]/5 cursor-pointer group' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.label}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {(item as any).status && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 bg-gray-100 text-gray-500">
                          {(item as any).status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                      {item.paymentMethod && (
                        <span className="text-[10px] text-gray-400">· {item.paymentMethod}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className={`text-sm font-bold ${cfg.amtColor}`}>
                      {cfg.prefix}{formatCurrency(item.amount)}
                    </p>
                    {isClickable && <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />}
                  </div>
                </div>
              );

              return href ? (
                <Link key={item._key} href={href}>{content}</Link>
              ) : (
                <div key={item._key}>{content}</div>
              );
            })}
            {displayLimit < recent.length && (
              <button
                onClick={() => setDisplayLimit(l => l + 20)}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-xs font-semibold text-[#050A30] hover:bg-[#050A30]/5 transition-colors"
              >
                <Loader2 size={13} className="opacity-50" />
                Load More · {recent.length - displayLimit} remaining
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
