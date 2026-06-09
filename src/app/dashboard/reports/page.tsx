'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSales, getExpenses, getInvoices } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import {
  Loader2, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Receipt, Download, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'profit' | 'sales' | 'expenses';
type Period = 'day' | 'week' | 'month';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodKey(date: Date, period: Period): string {
  if (period === 'day') {
    return date.toISOString().slice(0, 10);
  }
  if (period === 'week') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday start
    return d.toISOString().slice(0, 10);
  }
  // month
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function periodLabel(key: string, period: Period): string {
  if (period === 'month') {
    const [y, m] = key.split('-');
    return `${MONTHS[parseInt(m) - 1]} ${y.slice(2)}`;
  }
  if (period === 'week') {
    const d = new Date(key);
    return `Wk ${d.getMonth() + 1}/${d.getDate()}`;
  }
  const d = new Date(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('profit');
  const [period, setPeriod] = useState<Period>('month');

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const today = now.toISOString().split('T')[0];

  // Fetch all data — large limit so we get everything
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['report-all-sales'],
    queryFn: () => getSales({ limit: 1000, startDate: yearStart, endDate: today }),
  });
  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['report-all-expenses'],
    queryFn: () => getExpenses({ limit: 1000 }),
  });

  const isLoading = salesLoading || expLoading;

  // ── Normalise raw records ──────────────────────────────────────────────────
  const allSales: any[] = useMemo(() => {
    const raw = (salesData?.data as any)?.sales
      || (salesData as any)?.sales
      || salesData?.data
      || [];
    return Array.isArray(raw) ? raw : [];
  }, [salesData]);

  const allExpenses: any[] = useMemo(() => {
    const raw = (expData?.data as any)?.expenses
      || (expData as any)?.expenses
      || expData?.data
      || [];
    return Array.isArray(raw) ? raw : [];
  }, [expData]);

  // ── Summary totals ─────────────────────────────────────────────────────────
  const totalRevenue = useMemo(() =>
    allSales.reduce((s, x) => s + parseFloat(x.grandTotal || x.total || x.amount || 0), 0),
  [allSales]);

  const totalExpenses = useMemo(() =>
    allExpenses.reduce((s, x) => s + parseFloat(x.amount || 0), 0),
  [allExpenses]);

  const netProfit = totalRevenue - totalExpenses;

  // ── Group by period ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();

    for (const s of allSales) {
      const d = new Date(s.createdAt || s.date || s.invoiceDate || 0);
      if (isNaN(d.getTime())) continue;
      const k = periodKey(d, period);
      const cur = map.get(k) || { revenue: 0, expenses: 0 };
      cur.revenue += parseFloat(s.grandTotal || s.total || s.amount || 0);
      map.set(k, cur);
    }
    for (const e of allExpenses) {
      const d = new Date(e.date || e.createdAt || 0);
      if (isNaN(d.getTime())) continue;
      const k = periodKey(d, period);
      const cur = map.get(k) || { revenue: 0, expenses: 0 };
      cur.expenses += parseFloat(e.amount || 0);
      map.set(k, cur);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({
        label: periodLabel(k, period),
        revenue: v.revenue,
        expenses: v.expenses,
        profit: v.revenue - v.expenses,
      }));
  }, [allSales, allExpenses, period]);

  // ── Expense by category ────────────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of allExpenses) {
      const cat = e.category || 'Other';
      map.set(cat, (map.get(cat) || 0) + parseFloat(e.amount || 0));
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [allExpenses]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!chartData.length) { toast.error('No data to export'); return; }
    const rows = [
      ['Period', 'Revenue', 'Expenses', 'Profit'],
      ...chartData.map(r => [r.label, r.revenue, r.expenses, r.profit]),
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `easepay-report-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

  const TABS = [
    { key: 'profit' as Tab, label: 'Profit & Loss' },
    { key: 'sales' as Tab, label: 'Sales' },
    { key: 'expenses' as Tab, label: 'Expenses' },
  ];

  const metricCards = tab === 'profit' ? [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', trend: null },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50', trend: null },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50', trend: null },
    { label: 'Total Sales', value: allSales.length, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50', trend: null },
  ] : tab === 'sales' ? [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', trend: null },
    { label: 'No. of Sales', value: allSales.length, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', trend: null },
    { label: 'Avg. Sale', value: formatCurrency(allSales.length ? totalRevenue / allSales.length : 0), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', trend: null },
    { label: 'Profit Margin', value: `${totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', trend: null },
  ] : [
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50', trend: null },
    { label: 'No. of Records', value: allExpenses.length, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', trend: null },
    { label: 'Avg. Expense', value: formatCurrency(allExpenses.length ? totalExpenses / allExpenses.length : 0), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', trend: null },
    { label: 'Largest', value: formatCurrency(allExpenses.length ? Math.max(...allExpenses.map((e: any) => parseFloat(e.amount || 0))) : 0), icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50', trend: null },
  ];

  const displayChart = tab === 'profit'
    ? chartData
    : tab === 'sales'
    ? chartData.map(r => ({ label: r.label, value: r.revenue }))
    : chartData.map(r => ({ label: r.label, value: r.expenses }));

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['day', 'week', 'month'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          <button onClick={exportCSV}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors">
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
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full capitalize">{period}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-gray-300" size={24} />
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
            <p className="font-medium text-sm">No data yet</p>
            <p className="text-xs mt-1">Record some sales or expenses to see your report</p>
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
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₦${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)}
                contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#revGrad)"
                strokeWidth={2.5} name="Revenue" dot={false} />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad)"
                strokeWidth={2.5} name="Expenses" dot={false} />
              <Area type="monotone" dataKey="profit" stroke="#050A30" fill="none"
                strokeWidth={2} name="Profit" dot={false} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={displayChart as any[]} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₦${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)}
                contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
              <Bar dataKey="value" fill={tab === 'sales' ? '#050A30' : '#ef4444'}
                radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Expense by category */}
      {tab === 'expenses' && byCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">By Category</h3>
          <div className="space-y-2">
            {byCategory.map(cat => {
              const pct = totalExpenses > 0 ? ((cat.amount / totalExpenses) * 100).toFixed(1) : '0';
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-gray-700 truncate">{cat.category}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-[#050A30] transition-all"
                      style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
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
