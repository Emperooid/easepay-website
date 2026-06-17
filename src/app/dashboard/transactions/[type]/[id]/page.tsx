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
import { usePermissions } from '@/hooks/usePermissions';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { useAuth } from '@/context/AuthContext';
import { openReceiptPrintWindow, openWhatsApp, buildSaleWhatsAppMessage, buildInvoiceWhatsAppMessage, openInvoicePrintWindow } from '@/lib/receiptPrint';

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

const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Partial Payment', 'Overdue', 'Cancelled', 'Unpaid'];

export default function TransactionDetailPage() {
  const { isOwner, can } = usePermissions();
  const { user } = useAuth();
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

  const handleA4Print = (item: any) => {
    const businessName = (user as any)?.businessName || 'My Business';
    const lineItems = (item.items || item.saleItems || item.invoiceItems || []).map((li: any) => ({
      name: li.name || li.productName || li.description || 'Item',
      description: li.description || undefined,
      quantity: Number(li.quantity || li.qty || 1),
      unitPrice: Number(li.unitPrice || li.price || 0),
      total: Number(li.total || li.amount || (li.quantity || 1) * (li.unitPrice || li.price || 0)),
    }));
    const grandTotal = Number(item.grandTotal || item.amount || item.total || 0);
    const subtotal = Number(item.subtotal || item.subTotal || grandTotal);
    openInvoicePrintWindow({
      businessName,
      invoiceNo: item.invoiceNumber || item.saleNumber || item.referenceNumber,
      date: item.invoiceDate || item.createdAt
        ? new Date(item.invoiceDate || item.createdAt).toLocaleDateString('en-GB') : undefined,
      dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : undefined,
      customerName: item.customerName || item.customer?.name || undefined,
      customerEmail: item.customerEmail || item.customer?.email || undefined,
      customerPhone: item.customerPhone || item.customer?.phone || undefined,
      paymentMethod: item.paymentMethod,
      status: item.status,
      items: lineItems,
      subtotal,
      vatAmount: Number(item.vatAmount || item.tax || 0),
      discountAmount: Number(item.discount || item.discountAmount || 0),
      grandTotal,
      amountPaid: item.paidAmount || item.amountPaid || undefined,
      notes: item.notes || undefined,
      terms: item.terms || undefined,
      type: type?.toLowerCase() === 'invoice' ? 'INVOICE'
        : type?.toLowerCase() === 'expense' ? 'EXPENSE' : 'SALE',
    });
  };

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

  // Thermal print — runs after item is loaded (called below in JSX)
  const handleThermalPrint = (item: any) => {
    const businessName = (user as any)?.businessName || 'My Business';
    const lineItems = (item.items || item.saleItems || item.invoiceItems || []).map((li: any) => ({
      name: li.name || li.productName || li.description || 'Item',
      quantity: Number(li.quantity || li.qty || 1),
      unitPrice: Number(li.unitPrice || li.price || 0),
      total: Number(li.total || li.amount || (li.quantity || 1) * (li.unitPrice || li.price || 0)),
    }));
    const grandTotal = Number(item.grandTotal || item.amount || item.total || 0);
    const subtotal   = Number(item.subtotal || item.subTotal || grandTotal);
    openReceiptPrintWindow({
      businessName,
      invoiceNo: item.invoiceNumber || item.saleNumber || item.referenceNumber,
      date: item.invoiceDate || item.createdAt ? new Date(item.invoiceDate || item.createdAt).toLocaleDateString('en-GB') : undefined,
      customerName: item.customerName || item.customer?.name || undefined,
      paymentMethod: item.paymentMethod,
      items: lineItems,
      subtotal,
      vatAmount: Number(item.vatAmount || item.tax || 0),
      discountAmount: Number(item.discount || item.discountAmount || 0),
      grandTotal,
      receiptType: type?.toLowerCase() === 'invoice' ? 'INVOICE' : type?.toLowerCase() === 'expense' ? 'EXPENSE' : 'RECEIPT',
      notes: item.notes,
    });
  };

  const handleWhatsApp = (item: any) => {
    const businessName = (user as any)?.businessName || 'My Business';
    const pageUrl = window.location.href;
    const publicUrl = item.shareUrl || (item.publicToken ? `https://easepay-backend.onrender.com/i/${item.publicToken}` : pageUrl);
    const amount = Number(item.grandTotal || item.amount || item.total || 0);
    let msg: string;
    if (type?.toLowerCase() === 'invoice') {
      msg = buildInvoiceWhatsAppMessage({ businessName, customerName: item.customerName || item.customer?.name, amount, invoiceUrl: publicUrl, invoiceNo: item.invoiceNumber, dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB') : undefined });
    } else {
      msg = buildSaleWhatsAppMessage({ businessName, customerName: item.customerName, amount, receiptUrl: pageUrl, invoiceNo: item.invoiceNumber || item.saleNumber });
    }
    openWhatsApp(msg);
  };

  if (!isOwner && !can('view_transactions')) {
    return <AccessRestricted message="You don't have permission to view transaction details." />;
  }

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

        {/* WhatsApp share */}
        {(isSale || isInvoice) && (
          <button
            onClick={() => handleWhatsApp(item)}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#D1FAE5] text-[#059669] rounded-2xl text-sm font-bold hover:bg-[#A7F3D0] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#059669]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share via WhatsApp
          </button>
        )}

        {/* Thermal / Receipt print */}
        <button
          onClick={() => handleThermalPrint(item)}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#050A30] text-white rounded-2xl text-sm font-bold hover:bg-[#0a1460] transition-colors"
        >
          <Printer size={18} /> Print Receipt
        </button>

        {/* A4 / Standard Print */}
        <button
          onClick={() => handleA4Print(item)}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          <Printer size={18} /> Print A4
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
            <Edit size={18} /> Edit Invoice
          </button>
        )}

        {/* Edit — expenses */}
        {isExpense && (
          <button
            onClick={() => router.push(`/dashboard/expenses?editId=${id}`)}
            className="w-full flex items-center justify-center gap-2.5 py-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl text-sm font-bold hover:bg-blue-100 transition-colors"
          >
            <Edit size={18} /> Edit Expense
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
