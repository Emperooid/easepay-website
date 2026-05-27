'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardHome, getDashboardOverview } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Package } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { data: homeData, isLoading: homeLoading } = useQuery({
    queryKey: ['dashboard-home'],
    queryFn: getDashboardHome,
  });

  const { data: overviewData } = useQuery({
    queryKey: ['dashboard-overview', 'month'],
    queryFn: () => getDashboardOverview('month'),
  });

  const home = homeData?.data || homeData;
  const overview = overviewData?.data || overviewData;

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(home?.totalRevenue || home?.revenue || 0),
      icon: DollarSign,
      color: 'bg-green-50 text-green-600',
      trend: home?.revenueGrowth,
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(home?.totalExpenses || home?.expenses || 0),
      icon: Receipt,
      color: 'bg-red-50 text-red-600',
      trend: home?.expenseGrowth,
    },
    {
      label: 'Net Profit',
      value: formatCurrency(home?.netProfit || home?.profit || 0),
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-600',
      trend: home?.profitGrowth,
    },
    {
      label: 'Total Sales',
      value: home?.totalSales || home?.salesCount || 0,
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  const chartData = overview?.salesData || overview?.chartData || [];
  const recentTransactions = home?.recentTransactions || home?.transactions || [];

  if (homeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#050A30] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, trend }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{Math.abs(trend)}% vs last month</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue Overview</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#050A30" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#050A30" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#050A30" fill="url(#revenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentTransactions.slice(0, 8).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.description || tx.type || 'Transaction'}</p>
                  <p className="text-xs text-gray-400">{formatDate(tx.createdAt || tx.date)}</p>
                </div>
                <p className={`text-sm font-semibold ${tx.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                  {tx.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
