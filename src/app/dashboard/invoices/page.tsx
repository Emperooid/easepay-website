'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, createInvoice, updateInvoiceStatus, deleteInvoice, getNextInvoiceNumber } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, X, Search, Loader2, FileText, Trash2, ChevronDown } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  OVERDUE: 'bg-red-50 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-600',
  UNPAID: 'bg-orange-50 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function InvoicesPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ customerName: '', customerEmail: '', customerPhone: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', paymentMethod: 'CASH', notes: '', vatRate: '0', discount: '0' });
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['invoices', statusFilter], queryFn: () => getInvoices({ status: statusFilter || undefined, limit: 50 }) });
  const { data: nextNumData } = useQuery({ queryKey: ['next-invoice'], queryFn: getNextInvoiceNumber, enabled: showModal });
  const createMut = useMutation({ mutationFn: createInvoice, onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowModal(false); resetForm(); } });
  const deleteMut = useMutation({ mutationFn: deleteInvoice, onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }) });

  const invoices = (data?.data as any)?.invoices || data?.data || [];
  const filtered = invoices.filter((i: any) => i.customerName?.toLowerCase().includes(search.toLowerCase()) || i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => {
    setForm({ customerName: '', customerEmail: '', customerPhone: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', paymentMethod: 'CASH', notes: '', vatRate: '0', discount: '0' });
    setItems([{ name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const vatAmount = subtotal * (parseFloat(form.vatRate) / 100);
  const grandTotal = subtotal + vatAmount - parseFloat(form.discount || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invoiceNumber = (nextNumData?.data as any)?.invoiceNumber || `INV-${Date.now()}`;
    createMut.mutate({ ...form, invoiceNumber, items, subtotal, vatRate: parseFloat(form.vatRate), vatAmount, discount: parseFloat(form.discount), grandTotal });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">All Status</option>
          {['PAID', 'PENDING', 'OVERDUE', 'DRAFT', 'UNPAID', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-colors">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><FileText size={40} className="mx-auto mb-3 opacity-50" /><p className="text-sm">No invoices yet</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Invoice #', 'Customer', 'Date', 'Due', 'Amount', 'Status', ''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{inv.customerName}</p>
                    {inv.customerEmail && <p className="text-xs text-gray-400">{inv.customerEmail}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(inv.invoiceDate || inv.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(inv.grandTotal || inv.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteMut.mutate(inv.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold">New Invoice</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Customer Details</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
                    <input type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Date</label>
                  <input type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                    <option value="CASH">Cash</option><option value="CARD">Card</option><option value="TRANSFER">Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">Items</p>
                  <button type="button" onClick={() => setItems(p => [...p, { name: '', quantity: 1, unitPrice: 0, total: 0 }])} className="text-xs text-[#050A30] font-medium hover:underline">+ Add Item</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name" className="col-span-5 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#050A30]" required />
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} min="1" className="col-span-2 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none text-center" />
                      <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} min="0" step="0.01" placeholder="Price" className="col-span-3 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                      <p className="col-span-1 text-xs font-medium text-gray-700 text-right">{formatCurrency(item.total)}</p>
                      <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} className="col-span-1 text-gray-400 hover:text-red-500 disabled:opacity-0 flex justify-center"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">VAT Rate (%)</label>
                  <input type="number" value={form.vatRate} onChange={e => setForm(f => ({ ...f, vatRate: e.target.value }))} min="0" max="100" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discount (₦)</label>
                  <input type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {parseFloat(form.vatRate) > 0 && <div className="flex justify-between text-gray-600"><span>VAT ({form.vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>}
                {parseFloat(form.discount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(parseFloat(form.discount))}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1 mt-1"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none resize-none" />
              </div>

              <button type="submit" disabled={createMut.isPending} className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Create Invoice
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
