'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTaxSummary, getMonthlyTax } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Loader2, Calculator, TrendingUp, Receipt, DollarSign,
  AlertTriangle, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

const QUARTERS = [
  { value: '', label: 'Full Year' },
  { value: '1', label: 'Q1 (Jan–Mar)' },
  { value: '2', label: 'Q2 (Apr–Jun)' },
  { value: '3', label: 'Q3 (Jul–Sep)' },
  { value: '4', label: 'Q4 (Oct–Dec)' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TaxPage() {
  const year = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(year));
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [showAllEntries, setShowAllEntries] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(year - i));

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['tax-summary', selectedYear, selectedQuarter],
    queryFn: () => getTaxSummary(selectedYear, selectedQuarter || undefined),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['tax-monthly', selectedYear],
    queryFn: () => getMonthlyTax(undefined, selectedYear),
  });

  const tax = (summaryData?.data as any) || {};
  const monthly = (monthlyData?.data as any)?.months || (monthlyData?.data as any)?.data || [];

  const vatCollected = tax.vatCollected || tax.vat || 0;
  const totalRevenue = tax.totalRevenue || tax.revenue || 0;
  const totalExpenses = tax.totalExpenses || tax.expenses || 0;
  const netProfit = tax.netProfit || tax.profit || totalRevenue - totalExpenses;
  const taxableIncome = tax.taxableIncome || netProfit;
  const estimatedTax = tax.estimatedTax || tax.taxDue || 0;

  const entries = tax.entries || tax.transactions || [];
  const visibleEntries = showAllEntries ? entries : entries.slice(0, 8);

  const exportCSV = () => {
    const rows = [
      ['Period', 'Revenue', 'Expenses', 'Net Profit', 'VAT Collected', 'Taxable Income', 'Estimated Tax'],
      [selectedQuarter ? `Q${selectedQuarter} ${selectedYear}` : selectedYear, totalRevenue, totalExpenses, netProfit, vatCollected, taxableIncome, estimatedTax],
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tax-summary-${selectedYear}${selectedQuarter ? `-Q${selectedQuarter}` : ''}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax summary exported!');
  };

  const metricCards = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: Receipt, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: DollarSign, color: netProfit >= 0 ? 'text-blue-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50' },
    { label: 'VAT Collected', value: formatCurrency(vatCollected), icon: Calculator, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Taxable Income', value: formatCurrency(taxableIncome), icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Estimated Tax', value: formatCurrency(estimatedTax), icon: Calculator, color: 'text-[#050A30]', bg: 'bg-[#050A30]/5' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Filters */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Quarter</label>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
            {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        </div>
        <button onClick={exportCSV} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Warning if VAT is significant */}
      {vatCollected > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-700">VAT Remittance Required</p>
            <p className="text-xs text-orange-600 mt-0.5">You've collected {formatCurrency(vatCollected)} in VAT. Ensure this is remitted to FIRS by the due date.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
      ) : totalRevenue === 0 && !tax.vatCollected ? (
        <div className="text-center py-16 text-gray-400">
          <Calculator size={44} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">No tax data for {selectedQuarter ? `Q${selectedQuarter} ` : ''}{selectedYear}</p>
          <p className="text-sm mt-1">Record sales and expenses to see your tax summary</p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className={`font-bold text-base truncate ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Breakdown */}
          {monthly.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Monthly Breakdown — {selectedYear}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Month', 'Revenue', 'Expenses', 'Profit', 'VAT'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthly.map((m: any, idx: number) => {
                      const profit = (m.revenue || 0) - (m.expenses || 0);
                      return (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{m.month || MONTHS[idx]}</td>
                          <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(m.revenue || 0)}</td>
                          <td className="px-4 py-3 text-red-600 font-medium">{formatCurrency(m.expenses || 0)}</td>
                          <td className={`px-4 py-3 font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(profit)}</td>
                          <td className="px-4 py-3 text-purple-600">{formatCurrency(m.vat || m.vatCollected || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tax Entries */}
          {entries.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Tax Entries</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {visibleEntries.map((entry: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{entry.description || entry.name}</p>
                      <p className="text-xs text-gray-400">{entry.date ? formatDate(entry.date) : ''} · {entry.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(entry.amount)}</p>
                      {entry.vat && <p className="text-xs text-purple-500">VAT: {formatCurrency(entry.vat)}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {entries.length > 8 && (
                <button onClick={() => setShowAllEntries(s => !s)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-[#050A30] hover:bg-gray-50 border-t border-gray-100 transition-colors">
                  {showAllEntries ? <><ChevronUp size={14} /> Show Less</> : <><ChevronDown size={14} /> Show All ({entries.length})</>}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
