'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSalesReport, getExpensesReport, getProfitLossReport } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Download } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'profit' | 'sales' | 'expenses';
type Period = 'day' | 'week' | 'month';

function defaultRange() {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; // Jan 1 current year
  return { start, end };
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('profit');
  const [groupBy, setGroupBy] = useState<Period>('month');
  const { start: defStart, end: defEnd } = defaultRange();
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);

  const params = { groupBy, startDate: startDate || undefined, endDate: endDate || undefined };

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['report-sales', params],
    queryFn: () => getSalesReport(params),
    enabled: tab === 'sales' || tab === 'profit',
  });
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['report-exp', params],
    queryFn: () => getExpensesReport(params),
    enabled: tab === 'expenses' || tab === 'profit',
  });
  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['report-pl', params],
    queryFn: () => getProfitLossReport(params),
    enabled: tab === 'profit',
  });

  const isLoading = (tab === 'sales' && salesLoading) || (tab === 'expenses' && expLoading) || (tab === 'profit' && plLoading);

  const rawData = tab === 'sales'
    ? ((salesData?.data as any) || salesData)
    : tab === 'expenses'
    ? ((expData?.data as any) || expData)
    : ((plData?.data as any) || plData);

  const chartData: any[] = (rawData as any)?.data
    || (rawData as any)?.chartData
    || (rawData as any)?.report
    || (rawData as any)?.items
    || (rawData as any)?.records
    || (Array.isArray(rawData) ? rawData : []);

  const summary = (rawData as any)?.summary || (rawData as any)?.totals || {};

  const salesRaw = (salesData?.data as any) || salesData || {};
  const expRaw   = (expData?.data as any) || expData || {};
  const salesSummary = (salesRaw as any)?.summary || (salesRaw as any)?.totals || salesRaw || {};
  const expSummary   = (expRaw as any)?.summary  || (expRaw as any)?.totals  || expRaw  || {};

  const totalRevenue = salesSummary.totalRevenue || salesSummary.revenue || salesSummary.total || 0;
  const totalExpenses = expSummary.totalExpenses || expSummary.expenses || expSummary.total || 0;
  const netProfit = totalRevenue - totalExpenses;
  const totalSalesCount = salesSummary.totalSales || salesSummary.count || 0;

  const exportCSV = () => {
    if (!chartData.length) { toast.error('No data to export'); return; }
    const keys = Object.keys(chartData[0]);
    const rows = [keys.join(','), ...chartData.map((row: any) => keys.map(k => row[k]).join(','))].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `easepay-${tab}-report.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

  const TABS = [
    { key: 'profit' as Tab, label: 'Profit & Loss' },
    { key: 'sales' as Tab, label: 'Sales' },
    { key: 'expenses' as Tab, label: 'Expenses' },
  ];

  const metricCards = tab === 'profit' ? [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'Total Sales', value: totalSalesCount, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
  ] : tab === 'sales' ? [
    { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue || summary.revenue || 0), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'No. of Sales', value: summary.totalSales || summary.count || 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg. Sale', value: formatCurrency(summary.avgSale || (summary.totalSales ? (summary.totalRevenue / summary.totalSales) : 0)), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Growth', value: `${(summary.growth || 0).toFixed(1)}%`, icon: summary.growth >= 0 ? TrendingUp : TrendingDown, color: summary.growth >= 0 ? 'text-green-600' : 'text-red-500', bg: summary.growth >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ] : [
    { label: 'Total Expenses', value: formatCurrency(summary.totalExpenses || summary.total || 0), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'No. of Records', value: summary.count || 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Avg. Expense', value: formatCurrency(summary.avgExpense || 0), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Largest', value: formatCurrency(summary.largest || summary.max || 0), icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Period toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['day', 'week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setGroupBy(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${groupBy === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#050A30]" />
            <span className="text-gray-300 text-sm">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#050A30]" />
            {(startDate !== defStart || endDate !== defEnd) && (
              <button onClick={() => { setStartDate(defStart); setEndDate(defEnd); }} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Reset</button>
            )}
          </div>

          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={15} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">
            {tab === 'profit' ? 'Revenue vs Expenses' : tab === 'sales' ? 'Sales Revenue' : 'Expense Breakdown'}
          </h3>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full capitalize">{groupBy}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
            <p className="font-medium text-sm">No data for selected period</p>
            <p className="text-xs mt-1">Try adjusting your date range or period</p>
          </div>
        ) : tab === 'profit' ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad)" strokeWidth={2.5} name="Revenue" dot={false} />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2.5} name="Expenses" dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#050A30" strokeWidth={2} name="Profit" dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
              <Bar dataKey={tab === 'sales' ? 'revenue' : 'amount'} fill={tab === 'sales' ? '#050A30' : '#ef4444'} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category breakdown for expenses */}
      {tab === 'expenses' && (rawData as any)?.byCategory && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">By Category</h3>
          <div className="space-y-2">
            {((rawData as any).byCategory as any[]).map((cat: any) => {
              const total = (rawData as any)?.summary?.totalExpenses || 1;
              const pct = ((cat.amount / total) * 100).toFixed(1);
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-gray-700 truncate">{cat.category}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-[#050A30] transition-all" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                  </div>
                  <div className="w-20 text-right text-xs font-semibold text-gray-700">{formatCurrency(cat.amount)}</div>
                  <div className="w-12 text-right text-xs text-gray-400">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
