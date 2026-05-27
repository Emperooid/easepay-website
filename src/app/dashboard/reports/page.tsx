'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSalesReport, getExpensesReport, getProfitLossReport } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

type Tab = 'sales' | 'expenses' | 'profit';
type Period = 'day' | 'week' | 'month';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('profit');
  const [groupBy, setGroupBy] = useState<Period>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const params = { groupBy, startDate: startDate || undefined, endDate: endDate || undefined };

  const { data: salesData, isLoading: salesLoading } = useQuery({ queryKey: ['report-sales', params], queryFn: () => getSalesReport(params), enabled: tab === 'sales' });
  const { data: expData, isLoading: expLoading } = useQuery({ queryKey: ['report-exp', params], queryFn: () => getExpensesReport(params), enabled: tab === 'expenses' });
  const { data: plData, isLoading: plLoading } = useQuery({ queryKey: ['report-pl', params], queryFn: () => getProfitLossReport(params), enabled: tab === 'profit' });

  const isLoading = salesLoading || expLoading || plLoading;
  const rawData = tab === 'sales' ? salesData?.data : tab === 'expenses' ? expData?.data : plData?.data;
  const chartData = (rawData as any)?.data || (rawData as any)?.chartData || rawData || [];
  const summary = (rawData as any)?.summary || {};

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profit', label: 'Profit & Loss' },
    { key: 'sales', label: 'Sales' },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
          {(['day', 'week', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => setGroupBy(p)} className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${groupBy === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{p}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none" />
        </div>
      </div>

      {/* Summary Cards */}
      {summary && Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(summary).map(([key, val]: any) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
              <p className="text-xl font-bold text-gray-900">{typeof val === 'number' ? (key.toLowerCase().includes('count') || key.toLowerCase().includes('total') && val < 1000 ? val : formatCurrency(val)) : val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No data for selected period</div>
        ) : tab === 'profit' ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} name="Revenue" dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#050A30" strokeWidth={2} name="Profit" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Bar dataKey={tab === 'sales' ? 'revenue' : 'amount'} fill={tab === 'sales' ? '#050A30' : '#ef4444'} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
