'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvoice, getNextInvoiceNumber, getInventory, adjustStock } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Loader2, FileText, ChevronLeft, Package,
  Banknote, CreditCard, ArrowLeftRight, CheckCircle2,
  Printer, Share2, Send, Download,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { openWhatsApp, buildInvoiceWhatsAppMessage, openInvoicePrintWindow } from '@/lib/receiptPrint';
import { getInvoiceDownloadLink, sendInvoice } from '@/services/apiService';
import ThermalPrintModal from '@/components/ui/ThermalPrintModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/context/SubscriptionContext';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { Lock } from 'lucide-react';

interface InvoiceItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string;
}

export default function NewInvoicePage() {
  const { user } = useAuth();
  const { isOwner, can } = usePermissions();
  const { isTransactionBlocked, isTrialExpired } = useSubscription();
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', customerAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
    paymentMethod: 'TRANSFER', notes: '', terms: '',
    vatRate: '0', discountType: 'amount' as 'amount' | 'percent', discountValue: '0',
    status: 'Draft', partialAmountPaid: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [showThermalModal, setShowThermalModal] = useState(false);

  const allMethods = [['TRANSFER', 'Transfer', ArrowLeftRight], ['CASH', 'Cash', Banknote], ['POS', 'POS', CreditCard]];
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState(allMethods);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('payment_methods_config');
      if (stored) {
        const cfg = JSON.parse(stored);
        const keyMap: Record<string, string> = { TRANSFER: 'transfer', CASH: 'cash', POS: 'pos' };
        const filtered = allMethods.filter(([val]) => cfg[keyMap[val as string]] !== false);
        setEnabledPaymentMethods(filtered.length ? filtered : allMethods);
        if (filtered.length && !filtered.find(([v]) => v === form.paymentMethod)) {
          setForm(f => ({ ...f, paymentMethod: filtered[0][0] as string }));
        }
      }
    } catch {}
  }, []);

  const { data: nextNumData } = useQuery({ queryKey: ['next-invoice'], queryFn: getNextInvoiceNumber });
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const products = useMemo(() =>
    (inventoryData?.data as any)?.items || (inventoryData as any)?.items || inventoryData?.data || [],
    [inventoryData]
  );
  const filteredProducts = products.filter((p: any) => p.name?.toLowerCase().includes(productSearch.toLowerCase()));

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (res) => {
      if (res && !res.success && res.message) {
        toast.error(res.message);
        return;
      }
      // Reduce stock for inventory items
      for (const item of items) {
        if (item.inventoryItemId && item.quantity > 0) {
          try {
            await adjustStock(item.inventoryItemId, { quantityChange: -item.quantity, reason: 'invoice' });
          } catch { /* non-fatal */ }
        }
      }
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard-home'] });
      setCreatedInvoice((res as any)?.data?.invoice || (res as any)?.data || res);
      setSuccess(true);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create invoice'),
  });

  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: field === 'name' || field === 'description' ? value : Number(value) || 0 };
    }));
  };

  const pickProduct = (p: any) => {
    if (pickerIdx === null) return;
    setItems(prev => prev.map((item, i) => i === pickerIdx
      ? { ...item, name: p.name, unitPrice: p.unitPrice, inventoryItemId: p.id || p._id }
      : item
    ));
    setShowProductPicker(false);
    setPickerIdx(null);
    setProductSearch('');
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountAmt = form.discountType === 'percent' ? subtotal * parseFloat(form.discountValue || '0') / 100 : parseFloat(form.discountValue || '0');
  const afterDiscount = subtotal - discountAmt;
  const vatAmount = afterDiscount * (parseFloat(form.vatRate || '0') / 100);
  const grandTotal = afterDiscount + vatAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.name && i.quantity > 0 && i.unitPrice >= 0);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    if (!form.customerName) { toast.error('Customer name is required'); return; }
    const invoiceNumber = (nextNumData?.data as any)?.invoiceNumber || `INV-${Date.now()}`;
    createMut.mutate({
      ...form,
      invoiceNumber,
      items: validItems.map(i => ({ name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice })),
      subtotal, vatRate: parseFloat(form.vatRate), vatAmount,
      discount: discountAmt, grandTotal,
      paidAmount: form.status === 'Partial Payment' && parseFloat(form.partialAmountPaid) > 0
        ? parseFloat(form.partialAmountPaid) : undefined,
    });
  };

  const invoiceNumber = (nextNumData?.data as any)?.invoiceNumber || '—';

  if (success) {
    const invId = createdInvoice?.id || createdInvoice?._id;
    const publicToken = createdInvoice?.publicToken;
    const shareUrl = createdInvoice?.shareUrl || (publicToken ? `https://easepay-backend.onrender.com/i/${publicToken}` : invId ? `${window.location.origin}/dashboard/transactions/invoice/${invId}` : '');
    const businessName = (user as any)?.businessName || 'My Business';
    const invNum = createdInvoice?.invoiceNumber || invoiceNumber;

    const thermalReceiptData = {
      businessName,
      invoiceNo: invNum,
      date: form.invoiceDate,
      customerName: form.customerName || undefined,
      paymentMethod: form.paymentMethod,
      items: items.filter(i => i.name && i.unitPrice >= 0).map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
      })),
      subtotal,
      vatAmount,
      discountAmount: discountAmt > 0 ? discountAmt : 0,
      grandTotal,
      receiptType: 'INVOICE' as const,
      notes: form.notes || undefined,
    };

    const handleA4Print = () => {
      openInvoicePrintWindow({
        businessName,
        invoiceNo: invNum,
        date: form.invoiceDate,
        dueDate: form.dueDate || undefined,
        customerName: form.customerName || undefined,
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone || undefined,
        customerAddress: form.customerAddress || undefined,
        paymentMethod: form.paymentMethod,
        status: form.status,
        items: items.filter(i => i.name && i.unitPrice >= 0).map(i => ({
          name: i.name,
          description: i.description || undefined,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.quantity * i.unitPrice,
        })),
        subtotal,
        vatAmount,
        discountAmount: discountAmt > 0 ? discountAmt : 0,
        grandTotal,
        amountPaid: form.status === 'Partial Payment' && parseFloat(form.partialAmountPaid) > 0
          ? parseFloat(form.partialAmountPaid) : undefined,
        notes: form.notes || undefined,
        terms: form.terms || undefined,
        type: 'INVOICE',
      });
    };

    const handleWhatsApp = async () => {
      let pdfUrl: string | undefined;
      if (invId) {
        try {
          const res = await getInvoiceDownloadLink(invId) as any;
          pdfUrl = res?.url || res?.data?.url || res?.downloadUrl;
        } catch {}
      }

      // Try Web Share API with PDF file first (works on mobile Chrome/Edge)
      if (pdfUrl && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const response = await fetch(pdfUrl);
          const blob = await response.blob();
          const file = new File([blob], `Invoice-${invNum}.pdf`, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Invoice ${invNum}`,
              text: `Invoice from ${businessName}`,
              files: [file],
            });
            return;
          }
        } catch {}
      }

      // Fallback: WhatsApp text with PDF link
      const msg = buildInvoiceWhatsAppMessage({
        businessName,
        customerName: form.customerName || undefined,
        amount: grandTotal,
        invoiceUrl: pdfUrl || shareUrl || `${window.location.origin}/dashboard/invoices`,
        invoiceNo: invNum,
        dueDate: form.dueDate || undefined,
      });
      openWhatsApp(msg);
    };

    const handleEmail = async () => {
      if (!invId) { toast.error('Invoice ID not available'); return; }
      try {
        await sendInvoice(invId);
        toast.success('Invoice sent to customer!');
      } catch {
        if (form.customerEmail) {
          window.open(`mailto:${form.customerEmail}?subject=Invoice ${invNum}&body=Please find your invoice attached. Total: ${formatCurrency(grandTotal)}`, '_blank');
        } else {
          toast.error('No customer email on this invoice');
        }
      }
    };

    const handleDownloadPDF = async () => {
      if (!invId) { toast.error('Invoice not ready'); return; }
      try {
        const res = await getInvoiceDownloadLink(invId) as any;
        const url = res?.url || res?.data?.url || res?.downloadUrl;
        if (url) window.open(url, '_blank');
        else toast.error('PDF not available yet');
      } catch { toast.error('Could not get PDF link'); }
    };

    const handleCopyLink = () => {
      if (!shareUrl) { toast.error('Link not available'); return; }
      navigator.clipboard.writeText(shareUrl).then(() => toast.success('Invoice link copied!')).catch(() => toast.error('Could not copy'));
    };

    return (
      <div className="max-w-sm mx-auto py-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Invoice Created!</h2>
          <p className="text-gray-500 mt-0.5 font-mono text-xs">{invNum}</p>
        </div>

        <div className="w-full bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Customer</span><span className="font-semibold">{form.customerName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Grand Total</span><span className="font-bold text-green-600">{formatCurrency(grandTotal)}</span></div>
          {form.vatRate !== '0' && <div className="flex justify-between text-sm"><span className="text-gray-500">VAT ({form.vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span><span className="font-medium">{form.status}</span></div>
        </div>

        {/* QR code — same as mobile */}
        {shareUrl && (
          <div className="w-full bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`}
              alt="Invoice QR"
              className="w-36 h-36 rounded-lg"
            />
            <p className="text-xs text-gray-400">Customer scans to view & pay</p>
          </div>
        )}

        {/* 2×2 action grid — matches mobile's CreateInvoiceScreen success */}
        <div className="w-full grid grid-cols-2 gap-3">
          {/* WhatsApp */}
          <button onClick={handleWhatsApp}
            className="flex flex-col items-center gap-2 py-4 bg-[#F0FDF4] rounded-2xl hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#16A34A]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-900">WhatsApp</p>
              <p className="text-[10px] text-gray-500">Share PDF</p>
            </div>
          </button>

          {/* Email */}
          <button onClick={handleEmail}
            className="flex flex-col items-center gap-2 py-4 bg-[#EFF6FF] rounded-2xl hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
              <Send size={18} className="text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-900">Email</p>
              <p className="text-[10px] text-gray-500">Share PDF</p>
            </div>
          </button>

          {/* Print A4 */}
          <button onClick={handleA4Print}
            className="flex flex-col items-center gap-2 py-4 bg-[#F5F3FF] rounded-2xl hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
              <Printer size={18} className="text-purple-600" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-900">Print</p>
              <p className="text-[10px] text-gray-500">A4 / PDF</p>
            </div>
          </button>

          {/* Thermal */}
          <button onClick={() => setShowThermalModal(true)}
            className="flex flex-col items-center gap-2 py-4 bg-[#FFF7ED] rounded-2xl hover:opacity-90 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-[#FFEDD5] flex items-center justify-center">
              <Printer size={18} className="text-orange-600" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-gray-900">Thermal</p>
              <p className="text-[10px] text-gray-500">Bluetooth</p>
            </div>
          </button>
        </div>

        <ThermalPrintModal
          visible={showThermalModal}
          onClose={() => setShowThermalModal(false)}
          receiptData={thermalReceiptData}
        />

        {/* Download PDF + copy link row */}
        <div className="w-full grid grid-cols-2 gap-2">
          <button onClick={handleDownloadPDF}
            className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Download size={14} /> PDF
          </button>
          <button onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Share2 size={14} /> Copy Link
          </button>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={() => { setSuccess(false); setForm(f => ({ ...f, customerName: '', customerEmail: '', customerPhone: '', customerAddress: '', notes: '', terms: '' })); setItems([{ name: '', description: '', quantity: 1, unitPrice: 0 }]); }}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            New Invoice
          </button>
          <button onClick={() => router.push('/dashboard/invoices')}
            className="flex-1 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
            View All
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner && !can('manage_invoices')) {
    return <AccessRestricted message="You don't have permission to create invoices." />;
  }

  if (isTransactionBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Lock size={26} className="text-red-400" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1.5">
          {isTrialExpired ? 'Free Trial Ended' : 'Subscription Required'}
        </h2>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-5">
          {isTrialExpired
            ? 'Your 30-day free trial has ended. Subscribe to continue creating invoices.'
            : 'Your subscription has expired. Renew to continue creating invoices.'}
        </p>
        <Link href="/dashboard/settings/subscription"
          className="px-5 py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
          View Plans
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Create Invoice</h1>
          <p className="text-xs text-gray-400">Invoice # <span className="font-mono font-semibold text-[#050A30]">{invoiceNumber}</span></p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left — Customer & Items */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Bill To</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Customer Name *</label>
                <input type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} required placeholder="Full name or company"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="customer@email.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
                  <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="+234..."
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Address</label>
                <input type="text" value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} placeholder="Customer address"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Line Items</h3>
                <button type="button" onClick={() => setItems(p => [...p, { name: '', description: '', quantity: 1, unitPrice: 0 }])}
                  className="flex items-center gap-1 text-xs font-semibold text-[#050A30] hover:underline">
                  <Plus size={12} /> Add Item
                </button>
              </div>

              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-3">Unit Price</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1" />
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-5">
                      <div className="relative">
                        <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] pr-8" />
                        <button type="button" onClick={() => { setPickerIdx(idx); setShowProductPicker(true); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#050A30] transition-colors" title="Pick from inventory">
                          <Package size={14} />
                        </button>
                      </div>
                      <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description (optional)"
                        className="mt-1 w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#050A30] text-gray-500" />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="1" placeholder="1"
                        className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] text-center" />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₦</span>
                        <input type="number" value={item.unitPrice || ''} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} min="0" step="0.01" placeholder="0.00"
                          className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                      </div>
                    </div>
                    <div className="hidden sm:flex col-span-1 items-center justify-end pt-2">
                      <span className="text-xs font-bold text-gray-700">{formatCurrency(item.quantity * item.unitPrice)}</span>
                    </div>
                    <div className="col-span-3 sm:col-span-1 flex items-center justify-center">
                      <button type="button" onClick={() => items.length > 1 && setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1}
                        className="p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-0 transition-colors rounded-lg hover:bg-red-50">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes to Customer</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Thank you for your business..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Terms & Conditions</label>
                  <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={3} placeholder="Payment due within 30 days..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Right — Settings & Summary */}
          <div className="space-y-4">
            {/* Dates & Payment */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Invoice Details</h3>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Date</label>
                <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {enabledPaymentMethods.map(([val, label, Icon]: any) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: val }))}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${form.paymentMethod === val ? 'border-[#050A30] bg-[#050A30] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Draft', 'Sent', 'Paid', 'Partial Payment', 'Overdue', 'Cancelled'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${form.status === s
                        ? s === 'Paid' ? 'bg-green-500 text-white border-green-500'
                        : s === 'Partial Payment' ? 'bg-amber-500 text-white border-amber-500'
                        : s === 'Overdue' ? 'bg-red-500 text-white border-red-500'
                        : s === 'Sent' ? 'bg-blue-500 text-white border-blue-500'
                        : s === 'Cancelled' ? 'bg-gray-400 text-white border-gray-400'
                        : 'bg-[#050A30] text-white border-[#050A30]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {form.status === 'Partial Payment' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount Paid (₦)</label>
                  <input type="number" value={form.partialAmountPaid}
                    onChange={e => setForm(f => ({ ...f, partialAmountPaid: e.target.value }))}
                    min="0" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                  {parseFloat(form.partialAmountPaid) > 0 && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">
                      Balance due: {formatCurrency(Math.max(0, grandTotal - parseFloat(form.partialAmountPaid)))}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-bold text-gray-900">Summary</h3>

              {/* Discount */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount</label>
                <div className="flex gap-2">
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {(['amount', 'percent'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setForm(f => ({ ...f, discountType: t }))}
                        className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${form.discountType === t ? 'bg-[#050A30] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        {t === 'amount' ? '₦' : '%'}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} min="0" placeholder="0"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#050A30]" />
                </div>
              </div>

              {/* VAT */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">VAT Rate (%)</label>
                <input type="number" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))} min="0" max="100" step="0.01" placeholder="0"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#050A30]" />
              </div>

              <div className="pt-2 space-y-1.5 border-t border-gray-100">
                <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-{formatCurrency(discountAmt)}</span></div>}
                {vatAmount > 0 && <div className="flex justify-between text-xs text-gray-500"><span>VAT ({form.vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
              </div>

              <button type="submit" disabled={createMut.isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors shadow-sm mt-2">
                {createMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => { setShowProductPicker(false); setPickerIdx(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Pick from Inventory</h3>
              <button onClick={() => { setShowProductPicker(false); setPickerIdx(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-4">
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products..." autoFocus
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-gray-50" />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
              {inventoryLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
              ) : filteredProducts.length > 0 ? filteredProducts.map((p: any) => (
                <button key={p.id || p._id} onClick={() => pickProduct(p)}
                  disabled={p.quantity === 0}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-[#050A30]/5 border border-transparent hover:border-[#050A30]/20 rounded-xl transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category} · {p.quantity} in stock</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#050A30]">{formatCurrency(p.unitPrice)}</span>
                    {p.quantity === 0 && <p className="text-xs text-red-500">Out of stock</p>}
                  </div>
                </button>
              )) : (
                <div className="text-center py-8">
                  <Package size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">No products found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
