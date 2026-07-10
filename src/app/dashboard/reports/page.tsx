'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSales, getExpenses, getInvoices, getProfitLossReport } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Loader2, TrendingUp, ArrowUp, ArrowDown,
  Download, Calendar, RefreshCw, Search,
  Receipt, ChevronLeft, ChevronRight, BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { useSubscription } from '@/context/SubscriptionContext';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ReportsPage() {
  const { isOwner, can } = usePermissions();
  const { can: canSub } = useSubscription();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());   // 0-indexed
  const [selectedYear, setSelectedYear]  = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [showPicker, setShowPicker] = useState(false);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Fetch everything ──────────────────────────────────────────────────────
  const { data: salesData, isLoading: sl, refetch: refetchSales } = useQuery({
    queryKey: ['report-sales-all'],
    queryFn: () => getSales({ limit: 1000 }),
  });
  const { data: invData, isLoading: il, refetch: refetchInv } = useQuery({
    queryKey: ['report-invoices-all'],
    queryFn: () => getInvoices({ limit: 1000 }),
  });
  const { data: expData, isLoading: el, refetch: refetchExp } = useQuery({
    queryKey: ['report-expenses-all'],
    queryFn: () => getExpenses({ limit: 1000 }),
  });

  const { data: plData } = useQuery({
    queryKey: ['profit-loss-report', selectedMonth + 1, selectedYear],
    queryFn: () => getProfitLossReport({ month: selectedMonth + 1, year: selectedYear }),
    retry: false,
  });

  const isLoading = sl || il || el;

  const refetchAll = () => { refetchSales(); refetchInv(); refetchExp(); };

  // Normalise P&L payload — fall back to locally computed values
  const plPayload: any = (plData?.data as any) || (plData as any) || {};

  // ── Normalise raw arrays ──────────────────────────────────────────────────
  const rawSales: any[] = useMemo(() => {
    const r = (salesData?.data as any)?.sales || (salesData as any)?.sales || salesData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [salesData]);

  const rawInvoices: any[] = useMemo(() => {
    const r = (invData?.data as any)?.invoices || (invData as any)?.invoices || invData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [invData]);

  const rawExpenses: any[] = useMemo(() => {
    const r = (expData?.data as any)?.expenses || (expData as any)?.expenses || expData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [expData]);

  // ── Filter to selected month/year ─────────────────────────────────────────
  const inMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  };

  const monthlySales    = useMemo(() => rawSales.filter(s => inMonth(s.createdAt || s.date || '')), [rawSales, selectedMonth, selectedYear]);
  const monthlyInvoices = useMemo(() => rawInvoices.filter(i => inMonth(i.invoiceDate || i.createdAt || '')), [rawInvoices, selectedMonth, selectedYear]);
  const monthlyExpenses = useMemo(() => rawExpenses.filter(e => inMonth(e.date || e.createdAt || '')), [rawExpenses, selectedMonth, selectedYear]);

  // ── Totals (matching mobile logic exactly) ────────────────────────────────
  const { totalSales, totalExpenses, totalRevenue, totalTax, monthlyProfit } = useMemo(() => {
    let salesTotal = 0, expTotal = 0, taxTotal = 0, revenueTotal = 0, grossProfit = 0;

    for (const inv of monthlyInvoices) {
      const vat      = parseFloat(inv.vatAmount || inv.vat || 0);
      const grand    = parseFloat(inv.grandTotal || inv.total || inv.amount || 0);
      const sub      = parseFloat(inv.subTotal || inv.subtotal || 0);
      const discount = parseFloat(inv.discountAmount || inv.discount || 0);
      salesTotal   += grand - vat;
      taxTotal     += vat;
      revenueTotal += grand;
      const revenue = sub > 0 ? sub - discount : grand - vat - discount;
      const cogs = (inv.items || []).reduce((s: number, item: any) =>
        s + (parseFloat(item.costPrice || item.cost || 0) * (parseFloat(item.quantity) || 1)), 0);
      grossProfit += revenue - cogs;
    }

    for (const sale of monthlySales) {
      const vat   = parseFloat(sale.vatAmount || sale.vat || 0);
      const grand = parseFloat(sale.grandTotal || sale.total || sale.amount || 0);
      salesTotal   += grand - vat;
      taxTotal     += vat;
      revenueTotal += grand;
      (sale.items || []).forEach((si: any) => {
        const qty = parseFloat(si.quantity) || 1;
        const sp  = parseFloat(si.unitPrice || si.price || 0);
        const cp  = parseFloat(si.costPrice || si.cost || 0);
        grossProfit += (sp - cp) * qty;
      });
    }

    for (const exp of monthlyExpenses) {
      expTotal += parseFloat(exp.amount || 0);
    }

    return {
      totalSales:    salesTotal,
      totalExpenses: expTotal,
      totalRevenue:  revenueTotal,
      totalTax:      taxTotal,
      monthlyProfit: grossProfit - expTotal,
    };
  }, [monthlySales, monthlyInvoices, monthlyExpenses]);

  const balance = totalSales - totalExpenses;

  // ── Weekly chart (4 weeks of selected month) ──────────────────────────────
  const weeklyChart = useMemo(() => {
    const weeks = [
      { label: 'Week 1', income: 0, expenses: 0 },
      { label: 'Week 2', income: 0, expenses: 0 },
      { label: 'Week 3', income: 0, expenses: 0 },
      { label: 'Week 4', income: 0, expenses: 0 },
    ];

    const weekIdx = (day: number) => day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;

    for (const inv of monthlyInvoices) {
      const d = new Date(inv.invoiceDate || inv.createdAt || 0);
      weeks[weekIdx(d.getDate())].income += parseFloat(inv.grandTotal || inv.total || 0);
    }
    for (const sale of monthlySales) {
      const d = new Date(sale.createdAt || sale.date || 0);
      weeks[weekIdx(d.getDate())].income += parseFloat(sale.grandTotal || sale.total || 0);
    }
    for (const exp of monthlyExpenses) {
      const d = new Date(exp.date || exp.createdAt || 0);
      weeks[weekIdx(d.getDate())].expenses += parseFloat(exp.amount || 0);
    }

    return weeks;
  }, [monthlySales, monthlyInvoices, monthlyExpenses]);

  // ── Transaction list (all for the month, newest first) ────────────────────
  const allTransactions = useMemo(() => {
    const list: any[] = [];

    for (const inv of monthlyInvoices) {
      list.push({
        id: inv._id || inv.id,
        type: 'invoice',
        name: inv.customerName || inv.invoiceNumber || 'Invoice',
        date: inv.invoiceDate || inv.createdAt,
        amount: parseFloat(inv.grandTotal || inv.total || inv.amount || 0),
        status: inv.status,
        _txType: 'invoice',
      });
    }
    for (const sale of monthlySales) {
      const items = sale.items || [];
      const name = sale.customerName ||
        (items.length ? items.slice(0, 2).map((i: any) => i.name).filter(Boolean).join(', ') : 'Sale');
      list.push({
        id: sale._id || sale.id,
        type: 'sale',
        name,
        date: sale.createdAt || sale.date,
        amount: parseFloat(sale.grandTotal || sale.total || sale.amount || 0),
        _txType: 'sale',
      });
    }
    for (const exp of monthlyExpenses) {
      list.push({
        id: exp._id || exp.id,
        type: 'expense',
        name: exp.description || exp.category || 'Expense',
        date: exp.date || exp.createdAt,
        amount: parseFloat(exp.amount || 0),
        _txType: 'expense',
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthlySales, monthlyInvoices, monthlyExpenses]);

  const filtered = useMemo(() =>
    !search ? allTransactions : allTransactions.filter(tx =>
      tx.name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.type?.toLowerCase().includes(search.toLowerCase())
    ),
  [allTransactions, search]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!isOwner && !can('export_data')) { toast.error('You do not have permission to export reports.'); return; }
    if (!canSub('csvExport')) { toast.error('CSV export is available on Basic and Business plans. Please upgrade.'); return; }
    if (!allTransactions.length) { toast.error('No data to export'); return; }
    const rows = [
      ['Date', 'Type', 'Name', 'Amount'],
      ...allTransactions.map(tx => [
        tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : '',
        tx._txType === 'invoice' ? 'Invoice' : tx._txType === 'sale' ? 'Sale' : 'Expense',
        tx.name || '',
        tx.amount.toFixed(2),
      ]),
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EasePay_Report_${MONTHS[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

  const prevMonth = () => {
    setVisibleCount(10);
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    setVisibleCount(10);
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  if (!isOwner && !can('view_reports')) {
    return <AccessRestricted message="You don't have permission to view reports." />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-gray-900">Report</h1>
        <div className="flex items-center gap-2 flex-wrap">

          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 py-1">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 transition-colors">
              <ChevronLeft size={14} className="text-gray-500" />
            </button>
            <button onClick={() => setShowPicker(s => !s)}
              className="flex items-center gap-1.5 px-2 py-0.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded transition-colors">
              <Calendar size={13} />
              {isCurrentMonth ? 'This Month' : `${SHORT[selectedMonth]} ${selectedYear}`}
            </button>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-30">
              <ChevronRight size={14} className="text-gray-500" />
            </button>
          </div>

          {/* Month/Year picker dropdown */}
          {showPicker && (
            <div className="absolute top-24 right-4 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[240px]">
              <p className="text-xs font-semibold text-gray-500 mb-2">Year</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {years.map(y => (
                  <button key={y} onClick={() => setSelectedYear(y)}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${selectedYear === y ? 'bg-[#050A30] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {y}
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Month</p>
              <div className="grid grid-cols-3 gap-1">
                {SHORT.map((m, i) => (
                  <button key={m} onClick={() => { setSelectedMonth(i); setShowPicker(false); setVisibleCount(10); }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedMonth === i && selectedYear === (selectedYear) ? 'bg-[#050A30] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={refetchAll} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin text-gray-300" size={32} />
        </div>
      ) : (
        <>
          {/* ── Balance Card ── */}
          <div className="bg-[#050A30] rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-2">
              {MONTHS[selectedMonth]} {selectedYear} Total Transactions
            </p>
            <p className="text-white text-4xl font-bold">{formatCurrency(balance)}</p>
          </div>

          <p className="text-sm text-gray-500 font-medium">
            Showing transactions of {MONTHS[selectedMonth]} {selectedYear}
          </p>

          {/* ── 4 Metric Cards ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Monthly Profit */}
            <div className={`rounded-xl p-4 border ${monthlyProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${monthlyProfit >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                  <TrendingUp size={12} className={monthlyProfit >= 0 ? 'text-blue-600' : 'text-red-500'} />
                </div>
                <span className="text-xs text-gray-500 font-medium">{SHORT[selectedMonth]}'s Profit</span>
              </div>
              <p className={`text-xl font-bold ${monthlyProfit >= 0 ? 'text-[#050A30]' : 'text-red-600'}`}>
                {formatCurrency(monthlyProfit)}
              </p>
            </div>

            {/* Monthly Expenses */}
            <div className="rounded-xl p-4 border bg-red-50 border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                  <ArrowDown size={12} className="text-red-500" />
                </div>
                <span className="text-xs text-gray-500 font-medium">{SHORT[selectedMonth]}'s Expenses</span>
              </div>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            </div>

            {/* Total Sales incl. VAT */}
            <div className="rounded-xl p-4 border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <ArrowUp size={12} className="text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Total Sales</span>
              </div>
              <p className="text-xl font-bold text-[#050A30]">{formatCurrency(totalRevenue)}</p>
              {totalTax > 0 && (
                <p className="text-xs text-blue-500 mt-1">incl. {formatCurrency(totalTax)} VAT</p>
              )}
            </div>

            {/* Tax Collected */}
            <div className="rounded-xl p-4 border bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Receipt size={12} className="text-yellow-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Tax Collected</span>
              </div>
              <p className="text-xl font-bold text-yellow-800">{formatCurrency(totalTax)}</p>
              <p className="text-xs text-yellow-600 mt-1">VAT from invoices &amp; sales</p>
            </div>
          </div>

          {/* ── P&L Breakdown ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <BarChart3 size={15} className="text-[#050A30]" />
              <h3 className="text-sm font-bold text-gray-900">Profit &amp; Loss Breakdown</h3>
              <span className="ml-auto text-xs text-gray-400">{MONTHS[selectedMonth]} {selectedYear}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: 'Total Revenue',      value: plPayload?.totalRevenue    ?? totalRevenue,   color: 'text-green-600',   sign: '+' },
                { label: 'Cost of Goods',      value: plPayload?.costOfGoods     ?? plPayload?.cogs ?? 0, color: 'text-red-500',    sign: '-' },
                { label: 'Gross Profit',       value: plPayload?.grossProfit     ?? (totalRevenue - (plPayload?.costOfGoods ?? plPayload?.cogs ?? 0)), color: 'text-blue-600', sign: '' },
                { label: 'Operating Expenses', value: plPayload?.totalExpenses   ?? totalExpenses,  color: 'text-orange-600',  sign: '-' },
                { label: 'Net Profit',         value: plPayload?.netProfit       ?? monthlyProfit,  color: monthlyProfit >= 0 ? 'text-[#050A30] font-extrabold' : 'text-red-600 font-extrabold', sign: '' },
              ].map(({ label, value, color, sign }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-gray-600">{label}</p>
                  <p className={`text-sm font-bold ${color}`}>
                    {sign}{formatCurrency(Math.abs(Number(value)))}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Cash Flow Line Chart ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Cash Flow Trend</h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> In</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Out</span>
              </div>
            </div>

            {weeklyChart.every(w => w.income === 0 && w.expenses === 0) ? (
              <div className="text-center py-10 text-gray-400">
                <TrendingUp size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">No transactions for {MONTHS[selectedMonth]} {selectedYear}</p>
                <p className="text-xs mt-1">Record some sales or expenses to see the chart</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyChart} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `₦${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)}
                    contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="income" stroke="#3b82f6" strokeWidth={3}
                    dot={{ r: 4, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3}
                    dot={{ r: 4, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Recent Activity ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
              <span className="text-xs text-gray-400">{allTransactions.length} transactions</span>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Search size={13} className="text-gray-400 flex-shrink-0" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search activities..."
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No transactions found.</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {filtered.slice(0, visibleCount).map((tx, idx) => {
                    const isIncome = tx.type !== 'expense';
                    const href = `/dashboard/transactions/${tx._txType}/${tx.id}`;
                    return (
                      <Link key={tx.id || idx} href={href}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isIncome ? 'bg-blue-50' : 'bg-red-50'}`}>
                            {isIncome
                              ? <ArrowUp size={14} className="text-blue-600" />
                              : <ArrowDown size={14} className="text-red-500" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 truncate">{tx.name}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${tx._txType === 'sale' ? 'bg-yellow-50 text-yellow-700' : tx._txType === 'invoice' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'}`}>
                                {tx._txType}
                              </span>
                              {tx.status && (
                                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {tx.status}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {tx.date ? new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                        <p className={`text-sm font-bold flex-shrink-0 ml-3 ${isIncome ? 'text-blue-600' : 'text-red-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                      </Link>
                    );
                  })}
                </div>

                {visibleCount < filtered.length && (
                  <button onClick={() => setVisibleCount(v => v + 10)}
                    className="w-full py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 border-t border-gray-100 transition-colors">
                    Load More ({filtered.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
      )}
    </div>
  );
}
