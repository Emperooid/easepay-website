'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvoice, getNextInvoiceNumber, getInventory, adjustStock } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Plus, X, Loader2, FileText, ChevronLeft, Package,
  Banknote, CreditCard, ArrowLeftRight, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface InvoiceItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string;
}

export default function NewInvoicePage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', customerAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
    paymentMethod: 'TRANSFER', notes: '', terms: '',
    vatRate: '0', discountType: 'amount' as 'amount' | 'percent', discountValue: '0',
    status: 'PENDING',
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);

  const { data: nextNumData } = useQuery({ queryKey: ['next-invoice'], queryFn: getNextInvoiceNumber });
  const { data: inventoryData } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({ limit: 200 }), enabled: showProductPicker });

  const products = (inventoryData?.data as any)?.items || inventoryData?.data || [];
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
    });
  };

  const invoiceNumber = (nextNumData?.data as any)?.invoiceNumber || '—';

  if (success) {
    return (
      <div className="max-w-sm mx-auto py-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Invoice Created!</h2>
          <p className="text-gray-500 mt-0.5 font-mono text-xs">{invoiceNumber}</p>
        </div>
        <div className="w-full bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Customer</span><span className="font-semibold">{form.customerName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Grand Total</span><span className="font-bold text-green-600">{formatCurrency(grandTotal)}</span></div>
          {form.vatRate !== '0' && <div className="flex justify-between text-sm"><span className="text-gray-500">VAT ({form.vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>}
          <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span><span className="font-medium">{form.status}</span></div>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => { setSuccess(false); setForm(f => ({ ...f, customerName: '', customerEmail: '', customerPhone: '', customerAddress: '', notes: '', terms: '' })); setItems([{ name: '', description: '', quantity: 1, unitPrice: 0 }]); }}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            New Invoice
          </button>
          <button onClick={() => router.push('/dashboard/invoices')}
            className="flex-1 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
            View All Invoices
          </button>
        </div>
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
                  {[['TRANSFER', 'Transfer', ArrowLeftRight], ['CASH', 'Cash', Banknote], ['POS', 'POS', CreditCard]].map(([val, label, Icon]: any) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: val }))}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${form.paymentMethod === val ? 'border-[#050A30] bg-[#050A30] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Invoice Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
                  {['DRAFT', 'PENDING', 'PAID', 'UNPAID'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
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
              {filteredProducts.map((p: any) => (
                <button key={p.id} onClick={() => pickProduct(p)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-[#050A30]/5 border border-transparent hover:border-[#050A30]/20 rounded-xl transition-all text-left">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category} · {p.quantity} in stock</p>
                  </div>
                  <span className="text-sm font-bold text-[#050A30]">{formatCurrency(p.unitPrice)}</span>
                </button>
              ))}
              {filteredProducts.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No products found</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
