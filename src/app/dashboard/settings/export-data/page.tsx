'use client';

import { useState } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { ChevronLeft, Package, Receipt, Wallet, FileText, Download, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/context/SubscriptionContext';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { getInventory, getSales, getExpenses, getInvoices } from '@/services/apiService';

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Paid', PENDING: 'Pending', OVERDUE: 'Overdue', DRAFT: 'Draft',
  UNPAID: 'Unpaid', 'PARTIAL PAYMENT': 'Partial Payment', CANCELLED: 'Cancelled',
};

type CategoryKey = 'inventory' | 'sales' | 'expenses' | 'invoices';

function todayStamp() {
  return new Date().toISOString().split('T')[0];
}

// Uses papaparse for proper CSV escaping (commas/quotes/newlines in fields).
function downloadCSV(filename: string, rows: Record<string, any>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${todayStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportDataPage() {
  const { isOwner, can } = usePermissions();
  const { can: canSub } = useSubscription();
  const [loading, setLoading] = useState<CategoryKey | 'all' | null>(null);

  const allowed = isOwner || can('export_data');

  const guardSubscription = () => {
    if (!canSub('csvExport')) {
      toast.error('CSV export is available on Basic and Business plans. Please upgrade.');
      return false;
    }
    return true;
  };

  const exportInventory = async () => {
    const res = await getInventory({ limit: 5000 });
    const items: any[] = (res?.data as any)?.items || (res as any)?.items || res?.data || [];
    if (!items.length) { toast.error('No inventory to export'); return; }
    downloadCSV('EasePay_Inventory', items.map(p => ({
      name: p.name || '', category: p.category || '', unitPrice: p.unitPrice ?? '',
      quantity: p.quantity ?? '', costPrice: p.costPrice ?? '', unit: p.unit || '',
      color: p.color || '', description: p.description || '',
    })));
  };

  const exportSales = async () => {
    const res = await getSales({ limit: 5000 });
    const items: any[] = (res?.data as any)?.sales || (res as any)?.sales || res?.data || [];
    if (!items.length) { toast.error('No sales to export'); return; }
    downloadCSV('EasePay_Sales', items.map(s => ({
      Date: (s.createdAt || s.date) ? new Date(s.createdAt || s.date).toLocaleDateString('en-GB') : '',
      Description: s.description || (s.items || []).map((i: any) => i.name).filter(Boolean).join(', ') || 'Sale',
      'Payment Method': s.paymentMethod || '',
      'Amount (₦)': Number(s.grandTotal ?? s.total ?? s.amount ?? 0).toFixed(2),
    })));
  };

  const exportExpenses = async () => {
    const res = await getExpenses({ limit: 5000 });
    const items: any[] = (res?.data as any)?.expenses || (res as any)?.expenses || res?.data || [];
    if (!items.length) { toast.error('No expenses to export'); return; }
    downloadCSV('EasePay_Expenses', items.map(e => ({
      Date: (e.date || e.createdAt) ? new Date(e.date || e.createdAt).toLocaleDateString('en-GB') : '',
      Category: e.category || '',
      Description: e.description || '',
      Vendor: e.vendor || '',
      'Payment Method': e.paymentMethod || '',
      'Amount (₦)': Number(e.amount ?? 0).toFixed(2),
    })));
  };

  const exportInvoices = async () => {
    const res = await getInvoices({ limit: 5000 });
    const items: any[] = (res?.data as any)?.invoices || (res as any)?.invoices || res?.data || [];
    if (!items.length) { toast.error('No invoices to export'); return; }
    downloadCSV('EasePay_Invoices', items.map(inv => ({
      Date: (inv.invoiceDate || inv.createdAt) ? new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString('en-GB') : '',
      'Invoice Number': inv.invoiceNumber || '',
      Customer: inv.customerName || '',
      Status: STATUS_LABEL[inv.status] || inv.status || '',
      'Payment Method': inv.paymentMethod || '',
      'Amount (₦)': Number(inv.grandTotal ?? inv.total ?? 0).toFixed(2),
    })));
  };

  const CATEGORIES: { key: CategoryKey; icon: any; label: string; desc: string; run: () => Promise<void> }[] = [
    { key: 'inventory', icon: Package,  label: 'Inventory', desc: 'All products with stock, pricing and categories', run: exportInventory },
    { key: 'sales',     icon: Receipt,  label: 'Sales',     desc: 'Every recorded sale with amount and payment method', run: exportSales },
    { key: 'expenses',  icon: Wallet,   label: 'Expenses',  desc: 'All logged expenses with category and vendor', run: exportExpenses },
    { key: 'invoices',  icon: FileText, label: 'Invoices',  desc: 'Every invoice with status and totals', run: exportInvoices },
  ];

  const handleExport = async (cat: typeof CATEGORIES[number]) => {
    if (!guardSubscription()) return;
    setLoading(cat.key);
    try {
      await cat.run();
      toast.success(`${cat.label} exported!`);
    } catch {
      toast.error(`Could not export ${cat.label.toLowerCase()}. Check your connection and try again.`);
    } finally {
      setLoading(null);
    }
  };

  const handleExportAll = async () => {
    if (!guardSubscription()) return;
    setLoading('all');
    try {
      for (const cat of CATEGORIES) {
        await cat.run();
      }
      toast.success('All data exported!');
    } catch {
      toast.error('Could not export all data. Check your connection and try again.');
    } finally {
      setLoading(null);
    }
  };

  if (!allowed) {
    return <AccessRestricted message="You don't have permission to export data." />;
  }

  return (
    <div className="max-w-2xl space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Export Data</h1>
          <p className="text-xs text-gray-400">Download your business data as CSV files</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => handleExport(cat)} disabled={loading !== null}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group text-left disabled:opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-[#050A30]/10 group-hover:text-[#050A30] transition-colors flex-shrink-0">
                <cat.icon size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
                <p className="text-xs text-gray-400">{cat.desc}</p>
              </div>
            </div>
            {loading === cat.key ? (
              <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />
            ) : (
              <Download size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      <button onClick={handleExportAll} disabled={loading !== null}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#050A30] text-white rounded-xl text-sm font-bold hover:bg-[#0A1050] transition-colors disabled:opacity-60">
        {loading === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Download size={15} />}
        Export All Data
      </button>
    </div>
  );
}
