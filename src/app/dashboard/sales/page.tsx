'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSales, createSale, getInventory } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, X, Search, Loader2, ShoppingCart, Trash2 } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function SalesPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const qc = useQueryClient();

  const { data: salesData, isLoading } = useQuery({ queryKey: ['sales'], queryFn: () => getSales({ limit: 50 }) });
  const { data: inventoryData } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({ limit: 200 }), enabled: showModal });

  const createMutation = useMutation({
    mutationFn: createSale,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['dashboard-home'] }); setShowModal(false); setCart([]); },
  });

  const sales = (salesData?.data as any)?.sales || salesData?.data || [];
  const products = (inventoryData?.data as any)?.items || inventoryData?.data || [];

  const filtered = sales.filter((s: any) =>
    (s.description || s.items?.[0]?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter((p: any) =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: product.unitPrice, quantity: 1 }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleSale = () => {
    if (cart.length === 0) return;
    createMutation.mutate({
      amount: total,
      paymentMethod,
      items: cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sales..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-colors"
        >
          <Plus size={16} /> Add Sale
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No sales yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((sale: any) => (
              <div key={sale.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {sale.items?.map((i: any) => i.name).join(', ') || sale.description || 'Sale'}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(sale.createdAt || sale.date)} · {sale.paymentMethod}</p>
                </div>
                <p className="text-sm font-semibold text-green-600">{formatCurrency(sale.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Sale Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">New Sale</h3>
              <button onClick={() => { setShowModal(false); setCart([]); }} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Products */}
              <div className="flex-1 border-r overflow-y-auto p-4">
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#050A30]"
                />
                <div className="space-y-2">
                  {filteredProducts.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.category} · Stock: {p.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.unitPrice)}</p>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No products found</p>
                  )}
                </div>
              </div>

              {/* Cart */}
              <div className="w-64 flex flex-col p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Cart ({cart.length})</p>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200 text-sm">-</button>
                        <span className="text-xs w-5 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-gray-600 hover:bg-gray-200 text-sm">+</button>
                        <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 ml-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Cart is empty</p>}
                </div>

                <div className="border-t pt-3 mt-3 space-y-3">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                  <button
                    onClick={handleSale}
                    disabled={cart.length === 0 || createMutation.isPending}
                    className="w-full py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    Record Sale
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
