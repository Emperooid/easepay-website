'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSale, getExpense, getInvoice,
  deleteSale, deleteExpense, deleteInvoice,
  updateInvoiceStatus, sendInvoice, getInvoiceDownloadLink,
} from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, statusBadge } from '@/components/ui/Badge';
import {
  ChevronLeft, Loader2, ShoppingCart, Receipt, FileText,
  Trash2, Send, CheckCircle, AlertTriangle,
  Download, Share2, Printer, Edit, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useState } from 'react';

const TYPE_CONFIG: Record<string, {
  label: string; icon: any; iconBg: string; iconColor: string;
  amountColor: string; prefix: string;
  queryFn: (id: string) => any;
  deleteOp?: (id: string) => any;
}> = {
  sale: {
    label: 'Sale', icon: ShoppingCart,
    iconBg: 'bg-green-100', iconColor: 'text-green-600',
    amountColor: 'text-green-600', prefix: '+',
    queryFn: getSale, deleteOp: deleteSale,
  },
  expense: {
    label: 'Expense', icon: Receipt,
    iconBg: 'bg-red-100', iconColor: 'text-red-500',
    amountColor: 'text-red-600', prefix: '-',
    queryFn: getExpense, deleteOp: deleteExpense,
  },
  invoice: {
    label: 'Invoice Created', icon: FileText,
    iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
    amountColor: 'text-gray-900', prefix: '',
    queryFn: getInvoice, deleteOp: deleteInvoice,
  },
};

const INVOICE_STATUSES = ['PAID', 'PENDING', 'UNPAID', 'OVERDUE', 'DRAFT', 'CANCELLED'];

export default function TransactionDetailPage() {
  const { type, id } = useParams() as { type: string; id: string };
  const router = useRouter();
  const qc = useQueryClient();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const config = TYPE_CONFIG[type?.toLowerCase()];

  const { data, isLoading } = useQuery({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', type, id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Status updated');
      setShowStatusMenu(false);
    },
  });

  const sendMut = useMutation({
    mutationFn: () => sendInvoice(id),
    onSuccess: () => toast.success('Invoice sent via email!'),
    onError: (e: any) => toast.error(e.message || 'Failed to send'),
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => toast.success('Link copied!'))
      .catch(() => toast.error('Could not copy link'));
  };

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    try {
      const res = await getInvoiceDownloadLink(id);
      const url = (res?.data as any)?.url || (res as any)?.url;
      if (url) window.open(url, '_blank');
      else toast.error('Download link not available');
    } catch {
      toast.error('Failed to get download link');
    }
  };

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

  const item =
    (data?.data as any)?.sale ||
    (data?.data as any)?.expense ||
    (data?.data as any)?.invoice ||
    (data as any)?.sale ||
    (data as any)?.expense ||
    (data as any)?.invoice ||
    data?.data ||
    data ||
    {};

  const TypeIcon = config.icon;
  const isInvoice = type?.toLowerCase() === 'invoice';
  const isSale = type?.toLowerCase() === 'sale';
  const isExpense = type?.toLowerCase() === 'expense';
  const amount = item.grandTotal || item.total || item.amount || 0;

  const overviewRows = [
    { label: 'Reference / ID', value: item.invoiceNumber || item.id || id },
    { label: 'Date', value: formatDate(item.createdAt || item.date || item.invoiceDate) },
    ...(isInvoice || isSale ? [{ label: 'Customer', value: item.customerName || 'Walk-in' }] : []),
    ...(isExpense ? [
      { label: 'Category', value: item.category || '—' },
      { label: 'Vendor', value: item.vendor || '—' },
    ] : []),
    { label: 'Payment Method', value: item.paymentMethod || '—' },
    ...(item.status ? [{ label: 'Status', value: item.status }] : []),
    ...(isInvoice && item.dueDate ? [{ label: 'Due Date', value: formatDate(item.dueDate) }] : []),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200 pb-8">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ChevronLeft size={16} /> Back
      </button>

      {/* ── Hero Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center shadow-sm">
        <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mx-auto mb-4`}>
          <TypeIcon size={28} className={config.iconColor} />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">{config.label}</p>
        <p className={`text-3xl font-bold ${config.amountColor} mb-3`}>
          {config.prefix}{formatCurrency(amount)}
        </p>
        {item.status && (
          <div className="flex justify-center">
            <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
          </div>
        )}
      </div>

      {/* ── Overview Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-900">Overview</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {overviewRows.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-gray-400">{label}</span>
              <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%] truncate">{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Items Card ── */}
      {item.items?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-900">Items</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {item.items.map((li: any, i: number) => (
              <div key={i} className="flex items-start justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{li.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {li.quantity} × {formatCurrency(li.unitPrice || li.price || 0)}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {formatCurrency(li.total || (li.quantity * (li.unitPrice || li.price || 0)))}
                </p>
              </div>
            ))}
          </div>
          {/* Totals */}
          {(isInvoice || isSale) && (
            <div className="px-5 py-4 bg-gray-50/60 border-t border-gray-100 space-y-2">
              {(item.subtotal > 0) && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Sub Total</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              )}
              {item.vatAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>VAT ({item.vatRate || 7.5}%)</span>
                  <span>{formatCurrency(item.vatAmount)}</span>
                </div>
              )}
              {item.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(item.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(amount)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Description (expense) ── */}
      {isExpense && item.description && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-600">{item.description}</p>
        </div>
      )}

      {/* ── Notes (invoice) ── */}
      {isInvoice && item.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{item.notes}</p>
        </div>
      )}

      {/* ── QR / Share Link (invoice) ── */}
      {isInvoice && (item.publicToken || item.shareUrl) && (() => {
        const url = item.shareUrl || `https://easepay-backend.onrender.com/i/${item.publicToken}`;
        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`}
              alt="Invoice QR"
              className="w-40 h-40 rounded-xl"
            />
            <p className="text-xs text-gray-400">Scan to view this invoice in a browser</p>
            <button
              onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied!'); }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              <Share2 size={12} /> Share invoice link
            </button>
          </div>
        );
      })()}

      {/* ── Action Buttons ── */}
      <div className="space-y-2.5">
        {/* Download PDF — invoices */}
        {isInvoice && (
          <button
            onClick={handleDownloadPDF}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#050A30] text-white rounded-2xl text-sm font-bold hover:bg-[#0a1460] transition-colors"
          >
            <Download size={18} /> Download PDF
          </button>
        )}

        {/* Print */}
        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          <Printer size={18} /> Print
        </button>

        {/* Send via email — invoice with email */}
        {isInvoice && item.customerEmail && (
          <button
            onClick={() => sendMut.mutate()}
            disabled={sendMut.isPending}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-60"
          >
            {sendMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Send Invoice
          </button>
        )}

        {/* Update Status — invoices */}
        {isInvoice && (
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(s => !s)}
              className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-sm font-bold hover:bg-blue-100 transition-colors"
            >
              <RefreshCw size={18} /> Update Status
            </button>
            {showStatusMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-10">
                {INVOICE_STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => statusMut.mutate(s)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${item.status === s ? 'font-bold text-[#050A30]' : 'text-gray-700'}`}
                  >
                    {s}
                    {item.status === s && <CheckCircle size={14} className="text-[#050A30]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit — invoices */}
        {isInvoice && (
          <button
            onClick={() => router.push(`/dashboard/invoices/new?editId=${id}`)}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-sm font-bold hover:bg-blue-100 transition-colors"
          >
            <Edit size={18} /> Edit
          </button>
        )}

        {/* Share */}
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold hover:bg-gray-100 transition-colors"
        >
          <Share2 size={18} /> Share Link
        </button>

        {/* Delete */}
        {config.deleteOp && (
          <button
            onClick={() => { if (confirm(`Delete this ${config.label.toLowerCase()}?`)) deleteMut.mutate(); }}
            disabled={deleteMut.isPending}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            {deleteMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            Delete
          </button>
        )}
      </div>

      {showStatusMenu && <div className="fixed inset-0 z-0" onClick={() => setShowStatusMenu(false)} />}
    </div>
  );
}
