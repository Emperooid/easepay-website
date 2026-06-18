'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getSales, createSale, getInventory, adjustStock } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus, Search, Loader2, ShoppingCart, Trash2, CheckCircle2,
  Banknote, CreditCard, ArrowLeftRight, X, Package,
  ChevronLeft, ChevronRight, Share2, ExternalLink, Printer, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openInvoicePrintWindow, downloadInvoicePdf, shareInvoicePdfViaWhatsApp } from '@/lib/receiptPrint';
import { useAuth } from '@/context/AuthContext';
import ThermalPrintModal from '@/components/ui/ThermalPrintModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/context/SubscriptionContext';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import { Lock } from 'lucide-react';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  maxQty?: number;
}

type Step = 'list' | 'new' | 'success';

const ALL_PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Cash',     key: 'cash',     icon: Banknote },
  { value: 'TRANSFER', label: 'Transfer', key: 'transfer', icon: ArrowLeftRight },
  { value: 'POS',      label: 'POS/Card', key: 'pos',      icon: CreditCard },
];

function getEnabledPaymentMethods() {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('payment_methods_config') : null;
    if (stored) {
      const cfg = JSON.parse(stored);
      return ALL_PAYMENT_METHODS.filter(m => cfg[m.key] !== false);
    }
  } catch {}
  return ALL_PAYMENT_METHODS;
}

const PAGE_SIZE = 20;

function getPageNums(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4)          return [1, 2, 3, 4, 5, '…', total];
  if (cur >= total - 3)  return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', cur - 1, cur, cur + 1, '…', total];
}

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOwner, can } = usePermissions();
  const { isTransactionBlocked, isTrialExpired } = useSubscription();
  const [step, setStep] = useState<Step>('list');
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [enabledMethods, setEnabledMethods] = useState(ALL_PAYMENT_METHODS);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Load enabled payment methods from localStorage (same as mobile)
  useEffect(() => {
    const methods = getEnabledPaymentMethods();
    setEnabledMethods(methods);
    if (methods.length && !methods.find(m => m.value === paymentMethod)) {
      setPaymentMethod(methods[0].value);
    }
  }, []);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('Unpaid');
  const [vatEnabled, setVatEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [lastSale, setLastSale] = useState<any>(null);
  const [customItem, setCustomItem] = useState({ name: '', price: '' });
  const [showCustom, setShowCustom] = useState(false);
  const qc = useQueryClient();

  const { data: salesData, isLoading, isFetching } = useQuery({
    queryKey: ['sales', page],
    queryFn: () => getSales({ page, limit: PAGE_SIZE }),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createSale,
    onSuccess: async (res) => {
      if (!res.success) { toast.error(res.message || 'Failed to record sale'); return; }

      // Reduce inventory stock for each linked item — mirrors mobile OfflineSyncEngine
      for (const item of cart) {
        if (item.id && !item.id.startsWith('custom-')) {
          try {
            await adjustStock(item.id, { quantityChange: -item.quantity, reason: 'sale' });
          } catch {
            // non-fatal: sale is already recorded
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['sales-all'] });
      qc.invalidateQueries({ queryKey: ['sales-recent'] });
      qc.invalidateQueries({ queryKey: ['dashboard-home'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-recent'] });

      const saleData = (res.data as any)?.sale || res.data || res;
      setLastSale(saleData);
      setStep('success');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to record sale'),
  });

  const sales = useMemo(() => {
    const raw = (salesData?.data as any)?.sales || (salesData as any)?.sales || salesData?.data || [];
    if (!search) return raw;
    return raw.filter((s: any) =>
      (s.items?.map((i: any) => i.name).join(', ') || s.description || '').toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase())
    );
  }, [salesData, search]);

  const paginationInfo = (salesData?.data as any)?.pagination || null;
  const totalPages = paginationInfo?.totalPages || 1;
  const totalCount = paginationInfo?.total ?? sales.length;

  const products = useMemo(() => {
    const raw = (inventoryData?.data as any)?.items || (inventoryData as any)?.items || inventoryData?.data || [];
    if (!productSearch) return raw;
    return raw.filter((p: any) => p.name?.toLowerCase().includes(productSearch.toLowerCase()) || p.category?.toLowerCase().includes(productSearch.toLowerCase()));
  }, [inventoryData, productSearch]);

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = discountValue ? (discountType === 'percent' ? subtotal * parseFloat(discountValue) / 100 : parseFloat(discountValue)) : 0;
  const afterDiscount = subtotal - discount;
  const vat = vatEnabled ? afterDiscount * 0.075 : 0;
  const total = afterDiscount + vat;

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.maxQty !== undefined && existing.quantity >= existing.maxQty) {
          toast.error('Not enough stock');
          return prev;
        }
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: parseFloat(product.unitPrice) || 0,
        costPrice: parseFloat(product.costPrice) || 0,
        quantity: 1,
        maxQty: product.quantity,
      }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (i.maxQty !== undefined && qty > i.maxQty) return i;
      return { ...i, quantity: qty };
    }));
  };

  const addCustomItem = () => {
    if (!customItem.name || !customItem.price) return;
    const id = `custom-${Date.now()}`;
    setCart(prev => [...prev, { id, name: customItem.name, price: parseFloat(customItem.price), costPrice: 0, quantity: 1 }]);
    setCustomItem({ name: '', price: '' });
    setShowCustom(false);
  };

  const handleSale = () => {
    if (createMutation.isPending) return;
    if (cart.length === 0) { toast.error('Add items to cart first'); return; }
    createMutation.mutate({
      customerName: customerName.trim() || 'Walk-in Customer',
      paymentMethod,
      status: invoiceStatus,
      amount: total,
      grandTotal: total,
      total,
      subTotal: subtotal,
      discountAmount: discount || 0,
      discountType: discountType === 'percent' ? 'Percent' : 'Amount',
      vatIncluded: vatEnabled,
      taxAmount: vat || 0,
      items: cart.map(i => ({
        inventoryItemId: i.id.startsWith('custom-') ? undefined : i.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        amount: i.price * i.quantity,
        costPrice: i.costPrice || 0,
      })),
    });
  };

  const resetNew = () => {
    setCart([]);
    setCustomerName('');
    setInvoiceStatus('Unpaid');
    setVatEnabled(false);
    setDiscountValue('');
    setDiscountType('amount');
    setPaymentMethod('CASH');
    setProductSearch('');
    setShowCustom(false);
  };

  const goToList = () => { resetNew(); setStep('list'); setPage(1); };

  const handleShareReceipt = () => {
    const id = lastSale?.id || lastSale?.saleId;
    if (!id) { toast.error('Receipt link not available'); return; }
    const url = `${window.location.origin}/dashboard/transactions/sale/${id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Receipt link copied!'))
      .catch(() => toast.error('Could not copy link'));
  };

  if (step === 'success') {
    const saleId = lastSale?.id || lastSale?.saleId || lastSale?._id;
    const receiptUrl = saleId ? `${window.location.origin}/dashboard/transactions/sale/${saleId}` : '';
    const businessName = (user as any)?.businessName || 'My Business';

    const thermalReceiptData = {
      businessName,
      invoiceNo: lastSale?.invoiceNumber || lastSale?.saleNumber,
      date: new Date().toLocaleDateString('en-GB'),
      customerName: customerName.trim() || undefined,
      paymentMethod,
      items: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.price, total: i.price * i.quantity })),
      subtotal,
      vatAmount: vatEnabled ? vat : 0,
      discountAmount: discount > 0 ? discount : 0,
      grandTotal: total,
      receiptType: 'RECEIPT' as const,
    };

    const saleInvNum = lastSale?.invoiceNumber || lastSale?.saleNumber;

    const a4PrintData = {
      businessName,
      invoiceNo: saleInvNum,
      date: new Date().toISOString(),
      customerName: customerName.trim() || undefined,
      paymentMethod,
      status: invoiceStatus,
      items: cart.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        total: i.price * i.quantity,
      })),
      subtotal,
      vatAmount: vatEnabled ? vat : 0,
      discountAmount: discount > 0 ? discount : 0,
      grandTotal: total,
      type: 'SALE' as const,
    };

    const handleA4Print = () => openInvoicePrintWindow(a4PrintData);

    const handleDownloadPdf = async () => {
      const t = toast.loading('Generating PDF...');
      try {
        await downloadInvoicePdf(a4PrintData, `Receipt-${saleInvNum || Date.now()}.pdf`);
        toast.success('PDF downloaded!', { id: t });
      } catch {
        toast.error('Could not generate PDF', { id: t });
      }
    };

    const handleWhatsApp = async () => {
      const t = toast.loading('Generating PDF...');
      try {
        const result = await shareInvoicePdfViaWhatsApp(a4PrintData, `Receipt-${saleInvNum || Date.now()}.pdf`);
        if (result === 'downloaded') {
          toast.success('PDF saved! Open WhatsApp and attach the file to share it.', { id: t, duration: 5000 });
        } else {
          toast.dismiss(t);
        }
      } catch {
        toast.error('Could not generate PDF', { id: t });
      }
    };

    return (
      <div className="max-w-sm mx-auto py-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Sale Recorded!</h2>
          <p className="text-gray-500 text-sm mt-0.5">Transaction saved successfully</p>
        </div>
        <div className="w-full bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-bold text-green-600">{formatCurrency(lastSale?.amount || total)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span className="font-medium">{paymentMethod}</span></div>
          {customerName && <div className="flex justify-between text-sm"><span className="text-gray-500">Customer</span><span className="font-medium">{customerName}</span></div>}
          {vatEnabled && <div className="flex justify-between text-sm"><span className="text-gray-500">VAT (7.5%)</span><span className="font-medium">{formatCurrency(vat)}</span></div>}
          <div className="border-t pt-2 space-y-1">
            {cart.map(i => (
              <div key={i.id} className="flex justify-between text-xs text-gray-500">
                <span>{i.name} × {i.quantity}</span>
                <span>{formatCurrency(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action grid — matches mobile layout */}
        <div className="w-full space-y-2">
          {/* WhatsApp share */}
          <button onClick={handleWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#D1FAE5] rounded-xl text-sm font-semibold text-[#059669] hover:bg-[#A7F3D0] transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#059669]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share via WhatsApp
          </button>

          {/* Print row: A4 + Thermal */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleA4Print}
              className="flex items-center justify-center gap-1.5 py-3 bg-purple-50 rounded-xl text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors">
              <Printer size={16} /> Print A4
            </button>
            <button onClick={() => setShowThermalModal(true)}
              className="flex items-center justify-center gap-1.5 py-3 bg-[#050A30] text-white rounded-xl text-sm font-semibold hover:bg-[#0a1460] transition-colors">
              <Printer size={16} /> Thermal
            </button>
          </div>

          {/* Secondary row: download PDF + copy link + view */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleDownloadPdf}
              className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <Download size={14} /> PDF
            </button>
            <button onClick={handleShareReceipt}
              className="flex items-center justify-center gap-1.5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              <Share2 size={14} /> Copy Link
            </button>
            {saleId && (
              <button onClick={() => router.push(`/dashboard/transactions/sale/${saleId}`)}
                className="flex items-center justify-center gap-1.5 py-2.5 border border-[#050A30]/20 bg-[#050A30]/5 rounded-xl text-sm font-semibold text-[#050A30] hover:bg-[#050A30]/10 transition-colors">
                <ExternalLink size={14} /> View
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={() => { resetNew(); setStep('new'); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            New Sale
          </button>
          <button onClick={goToList} className="flex-1 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
            View All Sales
          </button>
        </div>

        <ThermalPrintModal
          visible={showThermalModal}
          onClose={() => setShowThermalModal(false)}
          receiptData={thermalReceiptData}
        />
      </div>
    );
  }

  if (step === 'new' && !isOwner && !can('manage_sales')) {
    return <AccessRestricted message="You don't have permission to record sales." />;
  }

  if (step === 'new' && isTransactionBlocked) {
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
            ? 'Your 30-day free trial has ended. Subscribe to continue recording sales.'
            : 'Your subscription has expired. Renew to continue recording sales.'}
        </p>
        <Link href="/dashboard/settings/subscription"
          className="px-5 py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
          View Plans
        </Link>
      </div>
    );
  }

  if (step === 'new') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3">
          <button onClick={goToList} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-600" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">New Sale</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Products Panel */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products..." className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-gray-50" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 max-h-[400px]">
              {inventoryLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                  <Loader2 size={28} className="animate-spin mb-2" />
                  <p className="text-xs">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No products found</p>
                  <button onClick={() => setShowCustom(true)} className="mt-2 text-xs text-[#050A30] font-medium hover:underline">Add custom item instead</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products.map((p: any) => (
                    <button key={p.id || p._id} onClick={() => addToCart(p)} disabled={p.quantity === 0}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-[#050A30]/5 border border-transparent hover:border-[#050A30]/20 rounded-xl text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.category} · {p.quantity} in stock</p>
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-sm font-bold text-[#050A30]">{formatCurrency(p.unitPrice)}</p>
                        {p.quantity === 0 && <p className="text-xs text-red-500">Out of stock</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showCustom ? (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-blue-700">Custom Item</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={customItem.name} onChange={e => setCustomItem(c => ({ ...c, name: e.target.value }))} placeholder="Item name" className="px-2 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <input type="number" value={customItem.price} onChange={e => setCustomItem(c => ({ ...c, price: e.target.value }))} placeholder="Price (₦)" min="0" className="px-2 py-1.5 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addCustomItem} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Add to Cart</button>
                    <button onClick={() => setShowCustom(false)} className="px-3 py-1.5 text-blue-600 text-xs font-medium hover:underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCustom(true)} className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-[#050A30] border border-dashed border-gray-200 hover:border-[#050A30]/30 rounded-xl transition-colors">
                  + Add custom item
                </button>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Cart</h3>
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600">Clear all</button>}
              </div>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-gray-50" />
            </div>

            <div className="flex-1 overflow-y-auto p-4 max-h-[220px] space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-300">
                  <ShoppingCart size={28} className="mx-auto mb-2" />
                  <p className="text-xs">Cart is empty</p>
                </div>
              ) : cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{formatCurrency(item.price)} ea</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-sm font-bold transition-colors">-</button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 1;
                        updateQty(item.id, Math.max(1, v));
                      }}
                      className="w-12 text-center text-xs font-bold border border-gray-200 rounded py-0.5 focus:outline-none focus:ring-1 focus:ring-[#050A30]"
                    />
                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-sm font-bold transition-colors">+</button>
                    <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Discount</span>
                  <div className="flex gap-1">
                    {(['amount', 'percent'] as const).map(t => (
                      <button key={t} onClick={() => setDiscountType(t)} className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${discountType === t ? 'bg-[#050A30] text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {t === 'amount' ? '₦' : '%'}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="0" min="0" className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#050A30]" />
              </div>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-gray-500">VAT (7.5%)</span>
                <div onClick={() => setVatEnabled(v => !v)} className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${vatEnabled ? 'bg-[#050A30]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${vatEnabled ? 'left-4' : 'left-0.5'}`} />
                </div>
              </label>

              {/* Invoice Status — matches mobile AddSaleScreen */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Invoice Status</p>
                <div className="flex flex-wrap gap-1">
                  {(['Draft', 'Partial Payment', 'Paid', 'Unpaid'] as const).map(s => (
                    <button key={s} onClick={() => setInvoiceStatus(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${invoiceStatus === s
                        ? s === 'Paid' ? 'bg-green-500 text-white border-green-500'
                        : s === 'Partial Payment' ? 'bg-amber-500 text-white border-amber-500'
                        : s === 'Draft' ? 'bg-gray-400 text-white border-gray-400'
                        : 'bg-[#050A30] text-white border-[#050A30]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
                {vatEnabled && <div className="flex justify-between text-xs text-gray-500"><span>VAT</span><span>{formatCurrency(vat)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {enabledMethods.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setPaymentMethod(value)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-semibold transition-all ${paymentMethod === value ? 'bg-[#050A30] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              <button onClick={handleSale} disabled={cart.length === 0 || createMutation.isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors shadow-sm">
                {createMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Processing...</> : `Record Sale · ${formatCurrency(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search sales..."
            className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white"
          />
        </div>
        <button
          onClick={() => setStep('new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-all hover:shadow-md"
        >
          <Plus size={15} /> Record Sale
        </button>
      </div>

      {/* Summary Strip */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Sales', value: totalCount, color: 'text-gray-900' },
            { label: 'Revenue (Page)', value: formatCurrency(sales.reduce((s: number, x: any) => s + Number(x.amount || 0), 0)), color: 'text-green-600' },
            { label: 'Today', value: sales.filter((s: any) => new Date(s.createdAt || s.date).toDateString() === new Date().toDateString()).length, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : sales.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ShoppingCart size={32} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium text-gray-500 text-sm">No sales recorded yet</p>
            <p className="text-xs mt-1">Record your first sale to get started</p>
            <button onClick={() => setStep('new')} className="mt-3 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
              Record Sale
            </button>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <div className="col-span-5">Items / Customer</div>
              <div className="col-span-2 text-center">Method</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className={`divide-y divide-gray-50 ${isFetching ? 'opacity-60' : ''} transition-opacity`}>
              {sales.map((sale: any) => {
                const itemNames = sale.items?.map((i: any) => i.name).join(', ') || sale.description || 'Sale';
                return (
                  <div
                    key={sale.id || sale._id}
                    onClick={() => router.push(`/dashboard/transactions/sale/${sale.id || sale._id}`)}
                    className="grid grid-cols-12 items-center px-4 py-3 hover:bg-[#050A30]/5 transition-colors cursor-pointer group"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#050A30] transition-colors">{itemNames}</p>
                      {sale.customerName && <p className="text-xs text-gray-400 mt-0.5">{sale.customerName}</p>}
                    </div>
                    <div className="hidden sm:flex col-span-2 justify-center">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{sale.paymentMethod || 'CASH'}</span>
                    </div>
                    <div className="hidden sm:block col-span-3 text-xs text-gray-400">{formatDate(sale.createdAt || sale.date)}</div>
                    <div className="hidden sm:flex col-span-2 justify-end items-center gap-2">
                      <span className="text-sm font-bold text-green-600">{formatCurrency(sale.amount)}</span>
                      <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                    <div className="sm:hidden flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{formatDate(sale.createdAt || sale.date)}</span>
                      <span className="text-sm font-bold text-green-600">{formatCurrency(sale.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isFetching}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {getPageNums(page, totalPages).map((n, i) =>
                    n === '…' ? (
                      <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                    ) : (
                      <button key={n} onClick={() => setPage(Number(n))} disabled={isFetching}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          page === n ? 'bg-[#050A30] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {n}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isFetching}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
