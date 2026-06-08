'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardHome, getSalesReport, getExpensesReport } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, ShoppingCart, Receipt, Package, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';

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
          <span className="text-3xl font-bold text-gray-900">{score}%</span>
          <span className="text-xs text-gray-400 font-medium">{label}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-600">Business Health Score</p>
    </div>
  );
}

export default function BusinessHealthPage() {
  const { data: homeData, isLoading } = useQuery({
    queryKey: ['dashboard-home'],
    queryFn: getDashboardHome,
  });

  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  const params = { groupBy: 'month', startDate, endDate };

  const { data: salesReport } = useQuery({
    queryKey: ['report-sales', params],
    queryFn: () => getSalesReport(params),
  });
  const { data: expReport } = useQuery({
    queryKey: ['report-exp', params],
    queryFn: () => getExpensesReport(params),
  });

  const home = (homeData?.data as any) || (homeData as any) || {};
  const score = home.businessHealthScore || home.healthScore || home.score || 0;

  const totalRevenue = home.totalRevenue || home.revenue || 0;
  const totalExpenses = home.totalExpenses || home.expenses || 0;
  const netProfit = home.netProfit || home.profit || totalRevenue - totalExpenses;
  const totalSales = home.totalSales || home.salesCount || 0;
  const inventoryValue = home.inventoryValue || home.stockValue || 0;
  const outstandingInvoices = home.outstandingInvoices || home.pendingInvoices || 0;

  const salesSummary = (salesReport?.data as any)?.summary || (salesReport as any)?.summary || {};
  const expSummary = (expReport?.data as any)?.summary || (expReport as any)?.summary || {};
  const growth = salesSummary.growth || 0;

  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

  const insights = [
    netProfit >= 0
      ? { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', text: `You're profitable with a ${profitMargin}% margin this year.` }
      : { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', text: `Expenses exceed revenue by ${formatCurrency(Math.abs(netProfit))}. Review your spending.` },
    growth >= 0
      ? { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', text: `Sales are up ${Math.abs(growth).toFixed(1)}% compared to last period.` }
      : { icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50', text: `Sales are down ${Math.abs(growth).toFixed(1)}% — consider reviewing your pricing or promotions.` },
    outstandingInvoices > 0
      ? { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', text: `You have ${outstandingInvoices} outstanding invoice${outstandingInvoices > 1 ? 's' : ''}. Follow up to improve cash flow.` }
      : { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', text: 'All invoices are settled. Great cash flow management!' },
  ].filter(Boolean);

  const metricCards = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'Total Sales', value: totalSales, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Inventory Value', value: formatCurrency(inventoryValue), icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Outstanding Invoices', value: outstandingInvoices, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={32} /></div>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Business Health</h1>
        <p className="text-sm text-gray-400 mt-0.5">An overview of your business performance and financial health.</p>
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center gap-6">
        <HealthGauge score={score} />
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Your Business Health Score</h2>
            <p className="text-sm text-gray-400 mt-1">
              Based on your revenue, expenses, profit margin, and outstanding invoices.
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                backgroundColor: score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0 — Critical</span>
            <span>40 — Fair</span>
            <span>60 — Strong</span>
            <span>100 — Excellent</span>
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
          <h3 className="text-sm font-bold text-gray-900">Insights & Recommendations</h3>
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
    </div>
  );
}
