'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInventory, createProduct, updateProduct, deleteProduct } from '@/services/apiService';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, Loader2, Package, Pencil, Trash2, X, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessRestricted } from '@/components/ui/AccessRestricted';

const CATEGORIES = [
  'General', 'Food & Beverages', 'Electronics', 'Clothing & Fashion',
  'Health & Beauty', 'Home & Garden', 'Sports & Fitness', 'Automotive',
  'Books & Stationery', 'Liquid', 'Other',
];
const STATUS_OPTIONS = ['Available', 'Out of Stock', 'Low Stock', 'Draft'];
const UNIT_OPTIONS = [
  { label: 'Pieces (Pcs)', value: 'Pcs' },
  { label: 'Kilograms (Kg)', value: 'Kg' },
  { label: 'Grams (g)', value: 'g' },
  { label: 'Liters (L)', value: 'L' },
  { label: 'Milliliters (ml)', value: 'ml' },
  { label: 'Meters (m)', value: 'm' },
  { label: 'Bags', value: 'Bags' },
  { label: 'Cartons', value: 'Cartons' },
  { label: 'Dozens', value: 'Dozens' },
  { label: 'Packs', value: 'Packs' },
  { label: 'Rolls', value: 'Rolls' },
  { label: 'Bottles', value: 'Bottles' },
  { label: 'Cans', value: 'Cans' },
  { label: 'Boxes', value: 'Boxes' },
  { label: 'Pairs', value: 'Pairs' },
];
const ITEMS_PER_PAGE = 10;

type ModalMode = 'add' | 'edit' | null;

function getProductStatus(p: any): string {
  if (p.status === 'draft') return 'Draft';
  if (p.quantity === 0) return 'Out of Stock';
  if (p.quantity <= (p.lowStockThreshold || 5)) return 'Low Stock';
  return 'Available';
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Available: 'bg-blue-50 text-blue-600 border border-blue-200',
    'Out of Stock': 'bg-red-50 text-red-600 border border-red-200',
    'Low Stock': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    Draft: 'bg-gray-100 text-gray-600 border border-gray-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.Draft}`}>
      {status}
    </span>
  );
}

export default function StockPage() {
  const { isOwner, can } = usePermissions();
  const [modal, setModal] = useState<ModalMode>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: '', category: '', unitPrice: '', costPrice: '', quantity: '',
    kg: '', description: '', barcode: '', status: '', lowStockThreshold: '5',
    expiryDate: '', manufacturingDate: '',
  });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['inventory'], queryFn: () => getInventory({ limit: 500 }) });

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeModal(); toast.success('Product added'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => updateProduct(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); closeModal(); toast.success('Product updated'); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Product deleted'); },
  });

  const allProducts = useMemo(() => (data?.data as any)?.items || (data as any)?.items || data?.data || [], [data]);

  const products = useMemo(() => {
    if (!search) return allProducts;
    const q = search.toLowerCase();
    return allProducts.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    );
  }, [allProducts, search]);

  const totalPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE));
  const paginated = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', category: '', unitPrice: '', costPrice: '', quantity: '', kg: 'Pcs', description: '', barcode: '', status: '', lowStockThreshold: '5', expiryDate: '', manufacturingDate: '' });
    setModal('add');
  };

  const openEdit = (p: any) => {
    setEditItem(p);
    setForm({
      name: p.name || '', category: p.category || '',
      unitPrice: String(p.unitPrice || ''), costPrice: String(p.costPrice || ''),
      quantity: String(p.quantity || ''),
      kg: p.unit || 'Pcs', description: p.description || '',
      barcode: p.barcode || '', status: p.status || '',
      lowStockThreshold: String(p.lowStockThreshold ?? 5),
      expiryDate: p.expiryDate ? String(p.expiryDate).slice(0, 10) : '',
      manufacturingDate: p.manufacturingDate ? String(p.manufacturingDate).slice(0, 10) : '',
    });
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditItem(null); };

  const buildPayload = (isDraft: boolean) => {
    const qty = parseInt(form.quantity) || 0;
    return {
      name: form.name,
      category: form.category,
      unitPrice: parseFloat(form.unitPrice) || 0,
      price:     parseFloat(form.unitPrice) || 0,   // backend alias
      costPrice: parseFloat(form.costPrice) || 0,
      quantity:  qty,
      stock:     qty,                                // backend compatibility alias (same as mobile)
      unit: form.kg || 'pcs',
      description: form.description || undefined,
      barcode: form.barcode || undefined,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      status: isDraft ? 'draft' : (form.status?.toLowerCase().replace(' ', '-') || 'available'),
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
      manufacturingDate: form.manufacturingDate ? new Date(form.manufacturingDate).toISOString() : undefined,
    };
  };

  const handleAdd = (isDraft: boolean) => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    const payload = buildPayload(isDraft);
    if (modal === 'edit' && editItem) updateMut.mutate({ id: editItem.id, data: payload });
    else createMut.mutate(payload);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map((p: any) => p.id)));
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const pageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    }
    return pages;
  };

  if (!isOwner && !can('manage_stocks')) {
    return <AccessRestricted message="You don't have permission to view or manage stock." />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search products..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition-colors bg-white">
            <SlidersHorizontal size={13} />
            Filter
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors"
          >
            <Plus size={13} />
            Add Stock
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Package size={32} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium text-gray-500 text-sm">{search ? 'No products match your search' : 'No products yet'}</p>
            {!search && (
              <button onClick={openAdd} className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
                Add Stock
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="border-b border-gray-100 bg-gray-50/50">
                  <tr>
                    <th className="px-3 py-2.5 w-9">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginated.length && paginated.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Code</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[140px] truncate">{p.name}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs hidden md:table-cell">{p.barcode || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{p.category}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-medium">{p.quantity}</td>
                      <td className="px-3 py-2.5 text-gray-700 font-medium">{formatCurrency(p.unitPrice)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={getProductStatus(p)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {products.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, products.length)} of {products.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                {pageNumbers().map((n, i) =>
                  n === '...' ? (
                    <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(Number(n))}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        currentPage === n
                          ? 'bg-blue-500 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">
                {modal === 'edit' ? 'Edit Product' : 'Add Stock'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Dangote Sugar 1kg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                    >
                      <option value="">Select...</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                    >
                      <option value="">Select...</option>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (₦)</label>
                  <input
                    type="number"
                    value={form.unitPrice}
                    onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cost Price (₦)</label>
                  <input
                    type="number"
                    value={form.costPrice}
                    onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit of Measurement</label>
                  <div className="relative">
                    <select
                      value={form.kg}
                      onChange={e => setForm(f => ({ ...f, kg: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                    >
                      {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Product Code</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    placeholder="SG-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Low Stock Alert</label>
                  <input
                    type="number"
                    value={form.lowStockThreshold}
                    onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                    placeholder="5"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Color, size, variant..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Manufacturing Date</label>
                  <input
                    type="date"
                    value={form.manufacturingDate}
                    onChange={e => setForm(f => ({ ...f, manufacturingDate: e.target.value }))}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {form.expiryDate && (() => {
                    const days = Math.ceil((new Date(form.expiryDate).getTime() - Date.now()) / 86400000);
                    return (
                      <p className={`text-xs mt-1 ${days < 0 ? 'text-red-500' : days <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {days < 0
                          ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
                          : days === 0 ? 'Expires today'
                          : `Expires in ${days} day${days === 1 ? '' : 's'}`}
                      </p>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => handleAdd(true)}
                disabled={isPending}
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleAdd(false)}
                disabled={isPending}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {isPending ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : (modal === 'edit' ? 'Save Changes' : 'Add Stock')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
