'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCreditScore, getCreditScoreFactors, getDashboardHome,
  getSales, getInvoices, getExpenses,
} from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, Receipt,
  Package, DollarSign, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import Link from 'next/link';
import { Lock } from 'lucide-react';

function HealthGauge({ score }: { score: number }) {
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Strong' : score >= 40 ? 'Fair' : 'Weak';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{Math.round(score)}</span>
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-600">Business Health Score</p>
    </div>
  );
}

export default function BusinessHealthPage() {
  const { can, isLoaded } = useSubscription();
  const [scoreData, setScoreData] = useState<any>(null);
  const [localLoading, setLocalLoading] = useState(true);

  // Try the dedicated credit-score endpoint first, same as mobile
  const { data: creditData, isLoading: creditLoading } = useQuery({
    queryKey: ['credit-score'],
    queryFn: getCreditScore,
    retry: false,
  });
  const { data: factorsData } = useQuery({
    queryKey: ['credit-score-factors'],
    queryFn: getCreditScoreFactors,
    retry: false,
  });
  const { data: homeData } = useQuery({
    queryKey: ['dashboard-home'],
    queryFn: getDashboardHome,
  });
  const { data: salesData } = useQuery({
    queryKey: ['bh-sales'],
    queryFn: () => getSales({ limit: 200 }),
  });
  const { data: invData } = useQuery({
    queryKey: ['bh-invoices'],
    queryFn: () => getInvoices({ limit: 200 }),
  });
  const { data: expData } = useQuery({
    queryKey: ['bh-expenses'],
    queryFn: () => getExpenses({ limit: 200 }),
  });

  // ── Compute score locally if backend doesn't return one (same as mobile) ──
  useEffect(() => {
    if (creditLoading) return;

    const credit = (creditData?.data as any) || (creditData as any);
    if (credit?.score !== undefined && credit?.metrics) {
      setScoreData(credit);
      setLocalLoading(false);
      return;
    }

    // Local computation fallback
    const allSales: any[] = (() => {
      const r = (salesData?.data as any)?.sales || (salesData as any)?.sales || salesData?.data || [];
      return Array.isArray(r) ? r : [];
    })();
    const allInvoices: any[] = (() => {
      const r = (invData?.data as any)?.invoices || (invData as any)?.invoices || invData?.data || [];
      return Array.isArray(r) ? r : [];
    })();
    const allExpenses: any[] = (() => {
      const r = (expData?.data as any)?.expenses || (expData as any)?.expenses || expData?.data || [];
      return Array.isArray(r) ? r : [];
    })();

    // Revenue consistency (how many months have had sales in last 3 months)
    const now = new Date();
    let activeMonths = 0;
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const hasSale = allSales.some(s => {
        const d = new Date(s.createdAt || s.date || 0);
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      }) || allInvoices.some(s => {
        const d = new Date(s.invoiceDate || s.createdAt || 0);
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });
      if (hasSale) activeMonths++;
    }
    const revConsistency = Math.round((activeMonths / 3) * 30);

    // Payment history — % paid invoices
    const paid = allInvoices.filter((i: any) => i.status === 'PAID').length;
    const payHistory = allInvoices.length > 0
      ? Math.round((paid / allInvoices.length) * 30)
      : 10;

    // Business age (based on oldest record)
    const dates = [
      ...allSales.map(s => new Date(s.createdAt || s.date || 0)),
      ...allInvoices.map(i => new Date(i.invoiceDate || i.createdAt || 0)),
    ].filter(d => !isNaN(d.getTime()));
    const oldestDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : now;
    const ageMonths = Math.max(0, (now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const busAge = Math.min(20, Math.round(ageMonths * 2));

    // Profile completeness (do we have a name/phone/address from homeData)
    const home = (homeData?.data as any) || (homeData as any) || {};
    const profFields = [home.businessName, home.phoneNumber, home.address].filter(Boolean).length;
    const profCompleteness = Math.round((profFields / 3) * 20);

    const totalScore = revConsistency + payHistory + busAge + profCompleteness;
    setScoreData({
      score: Math.min(100, totalScore),
      metrics: {
        revenueConsistency: (revConsistency / 30) * 100,
        paymentHistory:     (payHistory / 30) * 100,
        businessAge:        (busAge / 20) * 100,
        profileCompleteness:(profCompleteness / 20) * 100,
      },
      _local: true,
    });
    setLocalLoading(false);
  }, [creditData, creditLoading, salesData, invData, expData, homeData]);

  const home   = (homeData?.data as any) || (homeData as any) || {};
  const score  = scoreData?.score || 0;
  const metrics = scoreData?.metrics || {};
  const factors = (factorsData?.data as any)?.factors || (factorsData as any)?.factors || [];

  const totalRevenue   = home.totalRevenue || home.revenue || 0;
  const totalExpenses  = home.totalExpenses || home.expenses || 0;
  const netProfit      = home.netProfit || home.profit || totalRevenue - totalExpenses;
  const totalSales     = home.totalSales || home.salesCount || 0;
  const outstandingInv = home.outstandingInvoices || home.pendingInvoices || 0;
  const profitMargin   = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  const insights = [
    netProfit >= 0
      ? { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', text: `Your business is profitable with a ${profitMargin}% margin.` }
      : { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', text: `Expenses exceed revenue by ${formatCurrency(Math.abs(netProfit))}. Review your spending.` },
    score >= 60
      ? { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50', text: `Your business health score is ${score >= 80 ? 'excellent' : 'strong'} at ${Math.round(score)}/100.` }
      : { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', text: `Your health score of ${Math.round(score)}/100 needs improvement. Focus on consistent sales and paid invoices.` },
    outstandingInv > 0
      ? { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', text: `You have ${outstandingInv} outstanding invoice${outstandingInv > 1 ? 's' : ''}. Follow up to improve cash flow.` }
      : { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', text: 'All invoices are settled — great cash flow management!' },
  ];

  const metricCards = [
    { label: 'Total Revenue',       value: formatCurrency(totalRevenue),  icon: TrendingUp,   color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Total Expenses',      value: formatCurrency(totalExpenses), icon: Receipt,      color: 'text-red-600',    bg: 'bg-red-50'    },
    { label: 'Net Profit',          value: formatCurrency(netProfit),     icon: DollarSign,   color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'Total Sales',         value: totalSales,                    icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Outstanding Invoices',value: outstandingInv,                icon: AlertTriangle,color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Profit Margin',       value: `${profitMargin}%`,            icon: TrendingUp,   color: netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ];

  const scoreMetrics = [
    { label: 'Revenue Consistency', value: metrics.revenueConsistency || 0, color: '#22c55e' },
    { label: 'Payment History',     value: metrics.paymentHistory     || 0, color: '#3b82f6' },
    { label: 'Business Age',        value: metrics.businessAge        || 0, color: '#a855f7' },
    { label: 'Profile Completeness',value: metrics.profileCompleteness|| 0, color: '#f59e0b' },
  ];

  if (localLoading || creditLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={32} /></div>;
  }

  if (isLoaded && !can('businessHealth')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={26} className="text-gray-400" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1.5">Business Health Score</h2>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-5">
          Business Health Score is available on the Basic and Business plans.
        </p>
        <Link href="/dashboard/settings/subscription"
          className="px-5 py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
          Upgrade Now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Business Health</h1>
          <p className="text-sm text-gray-400 mt-0.5">An overview of your business performance and financial health.</p>
        </div>
        {scoreData?._local && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Computed locally</span>
        )}
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center gap-6">
        <HealthGauge score={score} />
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Your Business Health Score</h2>
            <p className="text-sm text-gray-400 mt-1">Based on revenue consistency, payment history, business age, and profile completeness.</p>
          </div>
          {/* Score breakdown bars */}
          <div className="space-y-2">
            {scoreMetrics.map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 flex-shrink-0">{m.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, m.value)}%`, backgroundColor: m.color }} />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{Math.round(m.value)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-900">Insights &amp; Recommendations</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {insights.map((insight, i) => {
            const Icon = insight.icon;
            return (
              <div key={i} className="flex items-start gap-3 px-5 py-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${insight.bg}`}>
                  <Icon size={15} className={insight.color} />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{insight.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backend factors if available */}
      {factors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-900">Score Factors</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {factors.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-700">{f.name || f.factor}</span>
                <span className={`text-sm font-bold ${f.score >= 70 ? 'text-green-600' : f.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {f.score}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
