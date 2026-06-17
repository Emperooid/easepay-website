'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSales, getExpenses, getInvoices } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import {
  Loader2, Calculator, TrendingUp, Receipt, DollarSign,
  AlertTriangle, ChevronDown, ChevronUp, Download,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { useSubscription } from '@/context/SubscriptionContext';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Mirrors mobile extractVat() exactly ─────────────────────────────────────
function extractVat(rec: any): number {
  const top = parseFloat(rec.vatAmount || rec.vat || rec.taxAmount || rec.tax || 0);
  if (top > 0) return top;
  const rate = parseFloat(rec.vatRate || 0);
  if (rate > 0) {
    const base = parseFloat(rec.subTotal || rec.subtotal || rec.total || 0);
    return base * (rate / 100);
  }
  return (rec.items || []).reduce((s: number, item: any) => {
    const qty   = parseFloat(item.quantity || 1);
    const price = parseFloat(item.unitPrice || item.price || 0);
    const r     = parseFloat(item.taxRate || item.vatRate || 0);
    return s + price * qty * r / 100;
  }, 0);
}

export default function TaxPage() {
  const { isOwner, can } = usePermissions();
  const { can: canSub } = useSubscription();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [showAllEntries, setShowAllEntries] = useState(false);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Fetch raw data (same endpoints mobile uses) ───────────────────────────
  const { data: invData,  isLoading: il } = useQuery({ queryKey: ['tax-invoices-all'],  queryFn: () => getInvoices({ limit: 1000 }) });
  const { data: saleData, isLoading: sl } = useQuery({ queryKey: ['tax-sales-all'],     queryFn: () => getSales({ limit: 1000 }) });
  const { data: expData,  isLoading: el } = useQuery({ queryKey: ['tax-expenses-all'],  queryFn: () => getExpenses({ limit: 1000 }) });

  const isLoading = il || sl || el;

  // ── Normalise ──────────────────────────────────────────────────────────────
  const rawInvoices: any[] = useMemo(() => {
    const r = (invData?.data as any)?.invoices || (invData as any)?.invoices || invData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [invData]);

  const rawSales: any[] = useMemo(() => {
    const r = (saleData?.data as any)?.sales || (saleData as any)?.sales || saleData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [saleData]);

  const rawExpenses: any[] = useMemo(() => {
    const r = (expData?.data as any)?.expenses || (expData as any)?.expenses || expData?.data || [];
    return Array.isArray(r) ? r : [];
  }, [expData]);

  // ── Filter to selected month/year ─────────────────────────────────────────
  const inMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  };

  // ── Compute tax entries (mirrors mobile fetchTaxInOut) ────────────────────
  const { vatIn, vatOut, entries, totalRevenue, totalExpenses } = useMemo(() => {
    let vatIn  = 0;
    let vatOut = 0;
    let totalRevenue  = 0;
    let totalExpenses = 0;
    const entries: any[] = [];

    for (const inv of rawInvoices) {
      if (!inMonth(inv.invoiceDate || inv.createdAt || inv.date || '')) continue;
      const vat   = extractVat(inv);
      const grand = parseFloat(inv.grandTotal || inv.total || inv.amount || 0);
      totalRevenue += grand;
      if (vat > 0) {
        vatIn += vat;
        entries.push({
          id:        `inv-${inv.id || inv._id}`,
          name:      inv.customerName || inv.invoiceNumber || 'Invoice',
          date:      inv.invoiceDate || inv.createdAt || inv.date,
          taxAmount: vat,
          direction: 'in',
          type:      'invoice',
        });
      }
    }

    for (const sale of rawSales) {
      if (!inMonth(sale.createdAt || sale.date || '')) continue;
      const vat   = extractVat(sale);
      const grand = parseFloat(sale.grandTotal || sale.total || sale.amount || 0);
      totalRevenue += grand;
      if (vat > 0) {
        vatIn += vat;
        entries.push({
          id:        `sale-${sale.id || sale._id}`,
          name:      sale.customerName || sale.description || 'Sale',
          date:      sale.createdAt || sale.date,
          taxAmount: vat,
          direction: 'in',
          type:      'sale',
        });
      }
    }

    for (const exp of rawExpenses) {
      if (!inMonth(exp.date || exp.createdAt || '')) continue;
      const vat = extractVat(exp);
      totalExpenses += parseFloat(exp.amount || 0);
      if (vat > 0) {
        vatOut += vat;
        entries.push({
          id:        `exp-${exp.id || exp._id}`,
          name:      exp.description || exp.category || 'Expense',
          date:      exp.date || exp.createdAt,
          taxAmount: vat,
          direction: 'out',
          type:      'expense',
        });
      }
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { vatIn, vatOut, entries, totalRevenue, totalExpenses };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawInvoices, rawSales, rawExpenses, selectedMonth, selectedYear]);

  const netProfit    = totalRevenue - totalExpenses;
  const netVat       = vatIn - vatOut;
  const taxableInc   = netProfit;
  const estimatedTax = taxableInc > 0 ? taxableInc * 0.30 : 0;

  // Write VAT net balance to localStorage so expense validation can read it
  useEffect(() => {
    if (vatIn > 0 || vatOut > 0) localStorage.setItem('computed_vat_net_balance', String(Math.max(0, netVat)));
  }, [netVat, vatIn, vatOut]);

  const visibleEntries = showAllEntries ? entries : entries.slice(0, 8);

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isNow = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
    if (isNow) return;
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  const exportCSV = () => {
    if (!isOwner && !can('export_data')) { toast.error('You do not have permission to export tax data.'); return; }
    if (!canSub('csvExport')) { toast.error('CSV export is available on Basic and Business plans. Please upgrade.'); return; }
    if (!entries.length) { toast.error('No tax data to export'); return; }
    const rows = [
      ['Date', 'Name', 'Type', 'Direction', 'Tax Amount'],
      ...entries.map(e => [
        e.date ? new Date(e.date).toLocaleDateString('en-GB') : '',
        e.name, e.type, e.direction === 'in' ? 'VAT Collected' : 'VAT Paid',
        e.taxAmount.toFixed(2),
      ]),
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `tax-summary-${SHORT[selectedMonth]}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax data exported!');
  };

  const metricCards = [
    { label: 'Total Revenue',   value: formatCurrency(totalRevenue),   icon: TrendingUp,   color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Total Expenses',  value: formatCurrency(totalExpenses),  icon: Receipt,      color: 'text-red-600',    bg: 'bg-red-50'    },
    { label: 'Net Profit',      value: formatCurrency(netProfit),      icon: DollarSign,   color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'VAT Collected',   value: formatCurrency(vatIn),          icon: Calculator,   color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'VAT on Expenses', value: formatCurrency(vatOut),         icon: Calculator,   color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Net VAT Payable', value: formatCurrency(Math.max(0, netVat)), icon: Calculator, color: 'text-[#050A30]', bg: 'bg-[#050A30]/5' },
  ];

  if (!isOwner && !can('view_tax')) {
    return <AccessRestricted message="You don't have permission to view the tax summary." />;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 flex-wrap">

        {/* Month navigator */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white transition-colors">
            <ChevronLeft size={13} className="text-gray-500" />
          </button>
          <span className="px-3 text-sm font-semibold text-gray-700">
            {SHORT[selectedMonth]} {selectedYear}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-30">
            <ChevronRight size={13} className="text-gray-500" />
          </button>
        </div>

        {/* Year select */}
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
          {years.map(y => <option key={y}>{y}</option>)}
        </select>

        <button onClick={exportCSV}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* VAT remittance warning */}
      {netVat > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-700">VAT Remittance Required</p>
            <p className="text-xs text-orange-600 mt-0.5">
              You have a net VAT payable of {formatCurrency(netVat)} for {MONTHS[selectedMonth]} {selectedYear}. Ensure this is remitted to FIRS by the due date.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : vatIn === 0 && vatOut === 0 && totalRevenue === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Calculator size={32} className="mx-auto mb-2 opacity-30" />
          <p className="font-medium text-gray-500 text-sm">No tax data for {SHORT[selectedMonth]} {selectedYear}</p>
          <p className="text-xs mt-1">Record sales with VAT or expenses to see your tax summary</p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className={`font-bold text-sm truncate ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* VAT Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight size={14} className="text-blue-600" />
                <p className="text-xs font-semibold text-blue-700">VAT Collected (Input)</p>
              </div>
              <p className="text-xl font-bold text-blue-800">{formatCurrency(vatIn)}</p>
              <p className="text-xs text-blue-500 mt-1">From invoices &amp; sales</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight size={14} className="text-red-500" />
                <p className="text-xs font-semibold text-red-700">VAT Paid (Output)</p>
              </div>
              <p className="text-xl font-bold text-red-700">{formatCurrency(vatOut)}</p>
              <p className="text-xs text-red-400 mt-1">From expenses</p>
            </div>
          </div>

          {/* Tax Entries */}
          {entries.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Tax Entries — {MONTHS[selectedMonth]} {selectedYear}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {visibleEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${entry.direction === 'in' ? 'bg-blue-50' : 'bg-red-50'}`}>
                        {entry.direction === 'in'
                          ? <ArrowUpRight size={12} className="text-blue-600" />
                          : <ArrowDownRight size={12} className="text-red-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{entry.name}</p>
                        <p className="text-xs text-gray-400">
                          {entry.date ? new Date(entry.date).toLocaleDateString('en-GB') : ''} ·{' '}
                          <span className={`capitalize font-medium ${entry.direction === 'in' ? 'text-blue-500' : 'text-red-400'}`}>
                            {entry.direction === 'in' ? 'VAT Collected' : 'VAT Paid'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ml-3 ${entry.direction === 'in' ? 'text-blue-600' : 'text-red-600'}`}>
                      {entry.direction === 'in' ? '+' : '-'}{formatCurrency(entry.taxAmount)}
                    </p>
                  </div>
                ))}
              </div>
              {entries.length > 8 && (
                <button onClick={() => setShowAllEntries(s => !s)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-[#050A30] hover:bg-gray-50 border-t border-gray-100 transition-colors">
                  {showAllEntries
                    ? <><ChevronUp size={14} /> Show Less</>
                    : <><ChevronDown size={14} /> Show All ({entries.length})</>
                  }
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
