'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDashboardHome, getDashboardOverview, getSales, getExpenses, getInvoices } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import {
  TrendingUp, DollarSign, ShoppingCart, Receipt,
  Search, ChevronRight, FileText, Plus,
  Wallet, Building2, Activity, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export default function DashboardPage() {
  const [search, setSearch] = useState('');
  const [activityPage, setActivityPage] = useState(10);
  const { user } = useAuth();
  const router = useRouter();

  const { data: homeData, isLoading } = useQuery({ queryKey: ['dashboard-home'], queryFn: getDashboardHome });
  const { data: overviewData } = useQuery({ queryKey: ['dashboard-overview'], queryFn: () => getDashboardOverview('month') });
  const { data: salesData } = useQuery({ queryKey: ['sales-recent'], queryFn: () => getSales({ limit: 50 }) });
  const { data: expensesData } = useQuery({ queryKey: ['expenses-recent'], queryFn: () => getExpenses({ limit: 50 }) });
  const { data: invoicesData } = useQuery({ queryKey: ['invoices-recent'], queryFn: () => getInvoices({ limit: 50 }) });

  const home = (homeData?.data || homeData || {}) as any;
  const overview = (overviewData?.data || overviewData || {}) as any;
  const sales = (salesData?.data as any)?.sales || salesData?.data || [];
  const expenses = (expensesData?.data as any)?.expenses || expensesData?.data || [];
  const invoices = (invoicesData?.data as any)?.invoices || invoicesData?.data || [];

  const activity = useMemo(() => {
    const items = [
      ...sales.map((s: any) => ({ ...s, _type: 'SALE', description: s.items?.map((i: any) => i.name).join(', ') || 'Sale', date: s.createdAt || s.date })),
      ...expenses.map((e: any) => ({ ...e, _type: 'EXPENSE', description: e.description || e.category, date: e.date || e.createdAt })),
      ...invoices.map((i: any) => ({ ...i, _type: 'INVOICE', amount: i.grandTotal || i.amount, description: `Invoice #${i.invoiceNumber} — ${i.customerName}`, date: i.createdAt })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (!search) return items;
    return items.filter(i => i.description?.toLowerCase().includes(search.toLowerCase()));
  }, [sales, expenses, invoices, search]);

  const chartData = overview?.salesData || overview?.chartData || [];
  const totalRevenue = home?.totalRevenue || home?.revenue || 0;
  const totalExpenses = home?.totalExpenses || home?.expenses || 0;
  const netProfit = home?.netProfit || home?.profit || totalRevenue - totalExpenses;
  const cashInHand = home?.cashInHand || home?.cashBalance || 0;
  const bankBalance = home?.bankBalance || 0;

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e: any) => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [expenses]);

  const COLORS = ['#050A30', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-xl w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-xl" />)}</div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Good {greeting}, {user?.firstName || 'there'} 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5">{user?.businessName || 'Your business overview'}</p>
        </div>
        <Link href="/dashboard/invoices/new" className="flex items-center gap-1.5 px-3 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-all hover:shadow-lg">
          <Plus size={15} /> New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp size={16} className="text-green-600" />} iconBg="bg-green-50" trend={home?.revenueGrowth} />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon={<Receipt size={16} className="text-red-500" />} iconBg="bg-red-50" trend={home?.expenseGrowth} />
        <StatCard label="Net Profit" value={formatCurrency(netProfit)} icon={<DollarSign size={16} className="text-blue-600" />} iconBg="bg-blue-50" dark={netProfit > 0} />
        <StatCard label="Total Sales" value={home?.totalSales || home?.salesCount || sales.length} icon={<ShoppingCart size={16} className="text-purple-600" />} iconBg="bg-purple-50" />
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Cash in Hand', value: cashInHand, icon: <Wallet size={18} className="text-green-600" />, bg: 'bg-green-50' },
          { label: 'Money in Bank', value: bankBalance, icon: <Building2 size={18} className="text-blue-600" />, bg: 'bg-blue-50' },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
            <div>
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-lg font-bold ${value < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(value)}</p>
              {value < 0 && <p className="text-xs text-red-400">Expenses exceed income</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Revenue Overview</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">This month</span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={185}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#050A30" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#050A30" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Revenue']} contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="revenue" stroke="#050A30" fill="url(#grad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#050A30' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-gray-300 gap-2">
              <TrendingUp size={28} className="opacity-40" />
              <p className="text-sm">No chart data yet</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Expenses by Category</h3>
          {expenseByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={expenseByCategory} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">
                    {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {expenseByCategory.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-gray-600 truncate max-w-[110px]">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-gray-300 gap-2">
              <Receipt size={28} className="opacity-40" />
              <p className="text-sm">No expenses yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{activity.length}</span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity..." className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#050A30] w-44 bg-gray-50" />
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Activity size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? 'No results found' : 'No activity yet'}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {activity.slice(0, activityPage).map((item: any) => (
                <div key={`${item._type}-${item.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/80 cursor-pointer transition-colors group"
                  onClick={() => router.push(`/dashboard/transactions/${item._type.toLowerCase()}/${item.id}`)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item._type === 'EXPENSE' ? 'bg-red-50' : item._type === 'INVOICE' ? 'bg-blue-50' : 'bg-green-50'}`}>
                      {item._type === 'EXPENSE' ? <ArrowDownRight size={14} className="text-red-500" /> : item._type === 'INVOICE' ? <FileText size={14} className="text-blue-500" /> : <ArrowUpRight size={14} className="text-green-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                      <p className="text-xs text-gray-400">{formatDate(item.date)} · <span className="capitalize">{item._type.toLowerCase()}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {item.status && <Badge variant={statusBadge(item.status)}>{item.status}</Badge>}
                    <p className={`text-sm font-bold ${item._type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                      {item._type === 'EXPENSE' ? '-' : '+'}{formatCurrency(item.amount)}
                    </p>
                    <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            {activity.length > activityPage && (
              <div className="px-4 py-3 border-t border-gray-50 text-center">
                <button onClick={() => setActivityPage(p => p + 10)} className="text-xs text-[#050A30] font-medium hover:underline">
                  Show more ({activity.length - activityPage} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Record Sale', href: '/dashboard/sales', icon: ShoppingCart, colors: 'text-green-600 bg-green-50 hover:bg-green-100' },
          { label: 'Add Expense', href: '/dashboard/expenses', icon: Receipt, colors: 'text-red-500 bg-red-50 hover:bg-red-100' },
          { label: 'New Invoice', href: '/dashboard/invoices/new', icon: FileText, colors: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
          { label: 'View Reports', href: '/dashboard/reports', icon: TrendingUp, colors: 'text-purple-600 bg-purple-50 hover:bg-purple-100' },
        ].map(({ label, href, icon: Icon, colors }) => (
          <Link key={href} href={href} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2.5 hover:shadow-md hover:border-gray-300 transition-all group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${colors}`}><Icon size={18} /></div>
            <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
