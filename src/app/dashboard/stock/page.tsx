'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInventory, getInventorySummary, createProduct, updateProduct, deleteProduct, adjustStock, importInventory } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Search, Loader2, Package, Pencil, Trash2, AlertTriangle,
  X, BarChart2, TrendingDown, Upload, Download, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'bag', 'roll', 'pair', 'set', 'dozen'];
const STOCK_FILTER_OPTIONS = ['All', 'Low Stock', 'Out of Stock', 'In Stock'];

type ModalMode = 'add' | 'edit' | 'adjust' | null;

export default function StockPage() {
  const [modal, setModal] = useState<ModalMode>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('All');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [form, setForm] = useState({
    name: '', category: '', unitPrice: '', costPrice: '',
    quantity: '', unit: 'pcs', description: '', barcode: '',
    lowStockThreshold: '5', expiryDate: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({ limit: 500 }) });
  const { data: summaryData } = useQuery({ queryKey: ['inventory-summary'], queryFn: getInventorySummary });

  const createMut = useMutation({ mutationFn: createProduct, onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inventory-summary'] }); closeModal(); toast.success('Product added'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateProduct(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeModal(); toast.success('Product updated'); } });
  const deleteMut = useMutation({ mutationFn: deleteProduct, onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); qc.invalidateQueries({ queryKey: ['inventory-summary'] }); toast.success('Product deleted'); } });
  const adjustMut = useMutation({
    mutationFn: ({ id, ...rest }: any) => adjustStock(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeModal(); toast.success('Stock adjusted'); },
    onError: (err: any) => toast.error(err.message || 'Failed to adjust stock'),
  });
  const importMut = useMutation({ mutationFn: importInventory, onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Import successful'); } });

  const allProducts = useMemo(() => (data?.data as any)?.items || data?.data || [], [data]);
  const summary = (summaryData?.data || summaryData || {}) as any;

  const products = useMemo(() => {
    let filtered = allProducts.filter((p: any) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
    );
    if (stockFilter === 'Low Stock') filtered = filtered.filter((p: any) => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 5));
    if (stockFilter === 'Out of Stock') filtered = filtered.filter((p: any) => p.quantity === 0);
    if (stockFilter === 'In Stock') filtered = filtered.filter((p: any) => p.quantity > (p.lowStockThreshold || 5));
    return filtered;
  }, [allProducts, search, stockFilter]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', category: '', unitPrice: '', costPrice: '', quantity: '', unit: 'pcs', description: '', barcode: '', lowStockThreshold: '5', expiryDate: '' });
    setModal('add');
  };

  const openEdit = (p: any) => {
    setEditItem(p);
    setForm({
      name: p.name || '', category: p.category || '', unitPrice: String(p.unitPrice || ''),
      costPrice: String(p.costPrice || ''), quantity: String(p.quantity || ''),
      unit: p.unit || 'pcs', description: p.description || '', barcode: p.barcode || '',
      lowStockThreshold: String(p.lowStockThreshold || 5),
      expiryDate: p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : '',
    });
    setModal('edit');
  };

  const openAdjust = (p: any) => { setEditItem(p); setAdjustQty(''); setAdjustType('add'); setAdjustReason(''); setModal('adjust'); };
  const closeModal = () => { setModal(null); setEditItem(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name, category: form.category,
      unitPrice: parseFloat(form.unitPrice), costPrice: parseFloat(form.costPrice || '0'),
      quantity: parseInt(form.quantity), unit: form.unit,
      description: form.description || undefined, barcode: form.barcode || undefined,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      expiryDate: form.expiryDate || undefined,
    };
    if (modal === 'edit' && editItem) updateMut.mutate({ id: editItem.id, data: payload });
    else createMut.mutate(payload);
  };

  const handleAdjust = () => {
    if (!adjustQty || isNaN(parseInt(adjustQty))) { toast.error('Enter a valid quantity'); return; }
    const change = adjustType === 'add' ? parseInt(adjustQty) : -parseInt(adjustQty);
    adjustMut.mutate({ id: editItem.id, quantityChange: change, reason: adjustReason || undefined });
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split('\n').filter(Boolean);
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const items = lines.slice(1).map(line => {
          const cols = line.split(',');
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = cols[i]?.trim(); });
          return {
            name: obj.name || obj.product || '',
            category: obj.category || 'Uncategorized',
            unitPrice: parseFloat(obj.unitprice || obj.price || '0'),
            costPrice: parseFloat(obj.costprice || obj.cost || '0'),
            quantity: parseInt(obj.quantity || obj.stock || '0'),
            unit: obj.unit || 'pcs',
          };
        }).filter(i => i.name);
        if (items.length === 0) { toast.error('No valid rows found'); return; }
        importMut.mutate(items);
      } catch { toast.error('Invalid CSV format'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'name,category,unitPrice,costPrice,quantity,unit\nProduct A,Electronics,5000,3000,100,pcs\nProduct B,Clothing,2000,1000,50,pcs';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stock_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const lowStockCount = allProducts.filter((p: any) => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 5)).length;
  const outOfStockCount = allProducts.filter((p: any) => p.quantity === 0).length;
  const stockWorth = allProducts.reduce((sum: number, p: any) => sum + (p.quantity * p.unitPrice), 0);
  const costWorth = allProducts.reduce((sum: number, p: any) => sum + (p.quantity * (p.costPrice || 0)), 0);

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products, barcode..." className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white" />
          </div>
          <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
            {STOCK_FILTER_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download size={14} /> Template
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-all hover:shadow-md">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Stock Overview Cards */}
      {!isLoading && allProducts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Products', value: allProducts.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Stock Value (Selling)', value: formatCurrency(stockWorth), icon: BarChart2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Low Stock Items', value: lowStockCount, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Out of Stock', value: outOfStockCount, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}><Icon size={18} className={color} /></div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className={`text-base font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Low stock warning */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
          <p className="text-sm text-orange-700 font-medium">{lowStockCount} product{lowStockCount > 1 ? 's are' : ' is'} running low on stock</p>
          <button onClick={() => setStockFilter('Low Stock')} className="ml-auto text-xs font-semibold text-orange-700 hover:underline">View</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={44} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">{search || stockFilter !== 'All' ? 'No products match filters' : 'No products yet'}</p>
            {!search && stockFilter === 'All' && (
              <button onClick={openAdd} className="mt-4 px-5 py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">Add Product</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Product', 'Category', 'Selling Price', 'Cost Price', 'Stock', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p: any) => {
                  const isLow = p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 5);
                  const isOut = p.quantity === 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{p.name}</p>
                        {p.barcode && <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>}
                        {p.expiryDate && (
                          <p className={`text-xs font-medium mt-0.5 ${new Date(p.expiryDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                            Exp: {new Date(p.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(p.unitPrice)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatCurrency(p.costPrice || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isOut ? 'bg-red-50 text-red-600 border border-red-200' : isLow ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                          {(isLow || isOut) && <AlertTriangle size={10} />}
                          {p.quantity} {p.unit || 'units'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openAdjust(p)} title="Adjust Stock" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <BarChart2 size={14} />
                          </button>
                          <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-[#050A30] hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100 z-10">
              <h3 className="text-base font-semibold text-gray-900">{modal === 'edit' ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" placeholder="e.g. Nike Air Max" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category *</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" placeholder="e.g. Footwear" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Selling Price (₦) *</label>
                  <input type="number" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} min="0" step="0.01" required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cost Price (₦)</label>
                  <input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} min="0" step="0.01"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity in Stock *</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="0" required
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Low Stock Alert</label>
                  <input type="number" value={form.lowStockThreshold} onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} min="0"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Barcode / SKU</label>
                  <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional product notes..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
              </div>
              <button type="submit" disabled={isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
                {isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : modal === 'edit' ? 'Save Changes' : 'Add Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {modal === 'adjust' && editItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Adjust Stock</h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="font-semibold text-gray-900">{editItem.name}</p>
                <p className="text-sm text-gray-500">Current stock: <span className="font-bold text-gray-900">{editItem.quantity} {editItem.unit || 'units'}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['add', 'remove'] as const).map(t => (
                  <button key={t} onClick={() => setAdjustType(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${adjustType === t ? (t === 'add' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t === 'add' ? '+ Add Stock' : '- Remove Stock'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason (optional)</label>
                <input type="text" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Restock, Damaged goods..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <button onClick={handleAdjust} disabled={adjustMut.isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
                {adjustMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Adjusting...</> : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
