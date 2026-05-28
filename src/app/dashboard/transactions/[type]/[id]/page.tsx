'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSale, getExpense, getInvoice, deleteExpense, deleteInvoice, updateInvoiceStatus, sendInvoice } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, statusBadge } from '@/components/ui/Badge';
import {
  ChevronLeft, Loader2, ShoppingCart, Receipt, FileText,
  Trash2, Send, MoreVertical, CheckCircle, Clock,
  Banknote, CreditCard, ArrowLeftRight, User, Calendar,
  Package, AlertTriangle, Download
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useState } from 'react';

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; queryFn: (id: string) => any; deleteOp?: (id: string) => any }> = {
  sale: { label: 'Sale', icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50', queryFn: getSale },
  expense: { label: 'Expense', icon: Receipt, color: 'text-red-600', bg: 'bg-red-50', queryFn: getExpense, deleteOp: deleteExpense },
  invoice: { label: 'Invoice', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', queryFn: getInvoice, deleteOp: deleteInvoice },
};

const PAYMENT_ICONS: Record<string, any> = {
  CASH: Banknote, TRANSFER: ArrowLeftRight, POS: CreditCard, CARD: CreditCard,
};

export default function TransactionDetailPage() {
  const { type, id } = useParams() as { type: string; id: string };
  const router = useRouter();
  const qc = useQueryClient();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const config = TYPE_CONFIG[type?.toLowerCase()];

  const { data, isLoading, error } = useQuery({
    queryKey: ['transaction', type, id],
    queryFn: () => config?.queryFn(id),
    enabled: !!config && !!id,
  });

  const deleteMut = useMutation({
    mutationFn: () => config?.deleteOp?.(id),
    onSuccess: () => { toast.success(`${config?.label} deleted`); router.back(); },
    onError: () => toast.error('Failed to delete'),
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => updateInvoiceStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transaction', type, id] }); toast.success('Status updated'); setShowStatusMenu(false); },
  });

  const sendMut = useMutation({
    mutationFn: () => sendInvoice(id),
    onSuccess: () => toast.success('Invoice sent via email!'),
    onError: (e: any) => toast.error(e.message || 'Failed to send'),
  });

  if (!config) {
    return (
      <div className="text-center py-16">
        <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">Unknown transaction type</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[#050A30] font-medium hover:underline">Go to Dashboard</Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={32} /></div>;
  }

  const item = data?.data || data || {};
  const TypeIcon = config.icon;
  const PaymentIcon = PAYMENT_ICONS[item.paymentMethod] || Banknote;

  const isInvoice = type?.toLowerCase() === 'invoice';
  const isSale = type?.toLowerCase() === 'sale';
  const isExpense = type?.toLowerCase() === 'expense';

  return (
    <div className="max-w-2xl space-y-4 animate-in fade-in duration-200">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          {isInvoice && item.customerEmail && (
            <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              {sendMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
            </button>
          )}
          {config.deleteOp && (
            <button onClick={() => { if (confirm(`Delete this ${config.label.toLowerCase()}?`)) deleteMut.mutate(); }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-100 transition-colors">
              {deleteMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
            </button>
          )}
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${config.bg}`}>
              <TypeIcon size={26} className={config.color} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{config.label}</p>
              {isInvoice && <p className="font-mono text-sm font-bold text-[#050A30] mt-0.5">{item.invoiceNumber}</p>}
              <p className={`text-2xl font-bold mt-1 ${isExpense ? 'text-red-600' : 'text-green-600'}`}>
                {isExpense ? '-' : '+'}{formatCurrency(item.grandTotal || item.amount || 0)}
              </p>
            </div>
          </div>
          {item.status && (
            <div className="relative">
              <button onClick={() => isInvoice && setShowStatusMenu(s => !s)} className={isInvoice ? 'cursor-pointer' : 'cursor-default'}>
                <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
              </button>
              {isInvoice && showStatusMenu && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[160px] overflow-hidden">
                  {['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'].map(s => (
                    <button key={s} onClick={() => statusMut.mutate(s)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${item.status === s ? 'font-bold text-[#050A30]' : 'text-gray-700'}`}>
                      {s} {item.status === s && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 pt-5 border-t border-gray-100">
          {[
            { icon: Calendar, label: 'Date', value: formatDate(item.createdAt || item.date || item.invoiceDate) },
            { icon: PaymentIcon, label: 'Payment', value: item.paymentMethod || 'N/A' },
            ...(isInvoice ? [
              { icon: User, label: 'Customer', value: item.customerName },
              { icon: Calendar, label: 'Due Date', value: item.dueDate ? formatDate(item.dueDate) : 'No due date' },
            ] : []),
            ...(isExpense ? [
              { icon: Receipt, label: 'Category', value: item.category },
              { icon: User, label: 'Vendor', value: item.vendor || 'N/A' },
            ] : []),
            ...(isSale ? [
              { icon: User, label: 'Customer', value: item.customerName || 'Walk-in' },
            ] : []),
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{value || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      {(item.items?.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Items</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {item.items.map((li: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Package size={14} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{li.name}</p>
                    {li.description && <p className="text-xs text-gray-400">{li.description}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(li.total || (li.quantity * li.price))}</p>
                  <p className="text-xs text-gray-400">{li.quantity} × {formatCurrency(li.unitPrice || li.price)}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Totals */}
          {isInvoice && (
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(item.subtotal || 0)}</span></div>
              {item.vatAmount > 0 && <div className="flex justify-between text-sm text-gray-600"><span>VAT ({item.vatRate}%)</span><span>{formatCurrency(item.vatAmount)}</span></div>}
              {item.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatCurrency(item.discount)}</span></div>}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200"><span>Grand Total</span><span>{formatCurrency(item.grandTotal)}</span></div>
            </div>
          )}
        </div>
      )}

      {/* Description (expense) */}
      {isExpense && item.description && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-600">{item.description}</p>
        </div>
      )}

      {/* Notes (invoice) */}
      {isInvoice && item.notes && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{item.notes}</p>
        </div>
      )}

      {/* Click outside to close menu */}
      {showStatusMenu && <div className="fixed inset-0 z-0" onClick={() => setShowStatusMenu(false)} />}
    </div>
  );
}
