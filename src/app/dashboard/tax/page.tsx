'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTaxSummary, getQuarterlyTax, getAnnualTax } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Calculator } from 'lucide-react';

export default function TaxPage() {
  const year = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(year));
  const [selectedQuarter, setSelectedQuarter] = useState('');

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['tax-summary', selectedYear, selectedQuarter],
    queryFn: () => getTaxSummary(selectedYear, selectedQuarter || undefined),
  });

  const tax = (summaryData?.data as any) || summaryData || {};

  const years = Array.from({ length: 5 }, (_, i) => String(year - i));

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none">
            {years.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Quarter</label>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none">
            <option value="">All Year</option>
            <option value="1">Q1 (Jan–Mar)</option>
            <option value="2">Q2 (Apr–Jun)</option>
            <option value="3">Q3 (Jul–Sep)</option>
            <option value="4">Q4 (Oct–Dec)</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : Object.keys(tax).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calculator size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No tax data for this period</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue', value: tax.totalRevenue || tax.revenue, color: 'text-green-600' },
            { label: 'Total Expenses', value: tax.totalExpenses || tax.expenses, color: 'text-red-600' },
            { label: 'Net Profit', value: tax.netProfit || tax.profit, color: 'text-blue-600' },
            { label: 'VAT Collected', value: tax.vatCollected || tax.vat, color: 'text-purple-600' },
            { label: 'Taxable Income', value: tax.taxableIncome, color: 'text-orange-600' },
            { label: 'Estimated Tax', value: tax.estimatedTax || tax.taxDue, color: 'text-[#050A30]' },
          ].filter(item => item.value !== undefined).map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm text-gray-500 mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value || 0)}</p>
            </div>
          ))}
        </div>
      )}

      {tax.breakdown && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Breakdown</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(tax.breakdown).map(([key, val]: any) => (
              <div key={key} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-medium">{typeof val === 'number' ? formatCurrency(val) : val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
