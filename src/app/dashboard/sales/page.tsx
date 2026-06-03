'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getSales, createSale, getInventory } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus, Search, Loader2, ShoppingCart, Trash2, CheckCircle2,
  Banknote, CreditCard, ArrowLeftRight, X, Package,
  ChevronLeft, ChevronRight, Share2, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxQty?: number;
}

type Step = 'list' | 'new' | 'success';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'TRANSFER', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'POS', label: 'POS/Card', icon: CreditCard },
];

const PAGE_SIZE = 20;

export default function SalesPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
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
  });
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => getInventory({ limit: 200 }),
    enabled: step === 'new',
  });

  const createMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (res) => {
      if (!res.success) return;
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['dashboard-home'] });
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
      return [...prev, { id: product.id, name: product.name, price: product.unitPrice, quantity: 1, maxQty: product.quantity }];
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
    setCart(prev => [...prev, { id, name: customItem.name, price: parseFloat(customItem.price), quantity: 1 }]);
    setCustomItem({ name: '', price: '' });
    setShowCustom(false);
  };

  const handleSale = () => {
    if (cart.length === 0) { toast.error('Add items to cart first'); return; }
    createMutation.mutate({
      amount: total,
      paymentMethod,
      items: cart.map(i => ({ id: i.id.startsWith('custom-') ? undefined : i.id, name: i.name, quantity: i.quantity, price: i.price })),
      customerName: customerName || undefined,
      vatAmount: vat || undefined,
      discount: discount || undefined,
    } as any);
  };

  const resetNew = () => {
    setCart([]);
    setCustomerName('');
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
    const saleId = lastSale?.id || lastSale?.saleId;
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

        {saleId && (
          <div className="w-full space-y-2">
            <button
              onClick={handleShareReceipt}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Share2 size={15} /> Share Receipt Link
            </button>
            <button
              onClick={() => router.push(`/dashboard/transactions/sale/${saleId}`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-[#050A30]/20 bg-[#050A30]/5 rounded-xl text-sm font-semibold text-[#050A30] hover:bg-[#050A30]/10 transition-colors"
            >
              <ExternalLink size={15} /> View Receipt
            </button>
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button onClick={() => { resetNew(); setStep('new'); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            New Sale
          </button>
          <button onClick={goToList} className="flex-1 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
            View All Sales
          </button>
        </div>
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
              {products.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No products found</p>
                  <button onClick={() => setShowCustom(true)} className="mt-2 text-xs text-[#050A30] font-medium hover:underline">Add custom item instead</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products.map((p: any) => (
                    <button key={p.id} onClick={() => addToCart(p)} disabled={p.quantity === 0}
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
                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
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

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Discount</span><span>-{formatCurrency(discount)}</span></div>}
                {vatEnabled && <div className="flex justify-between text-xs text-gray-500"><span>VAT</span><span>{formatCurrency(vat)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t"><span>Total</span><span>{formatCurrency(total)}</span></div>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
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
                    key={sale.id}
                    onClick={() => router.push(`/dashboard/transactions/sale/${sale.id}`)}
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {totalCount} total records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || isFetching}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={13} /> Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || isFetching}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight size={13} />
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
