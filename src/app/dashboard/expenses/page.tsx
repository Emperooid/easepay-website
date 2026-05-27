'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, createExpense, deleteExpense } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, X, Search, Loader2, Receipt, Trash2 } from 'lucide-react';

const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Rent', 'Salaries', 'Supplies', 'Marketing', 'Maintenance', 'Other'];

export default function ExpensesPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ amount: '', category: 'Supplies', description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'CASH', vendor: '' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => getExpenses({ limit: 50 }) });
  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['dashboard-home'] }); setShowModal(false); resetForm(); },
  });
  const deleteMut = useMutation({ mutationFn: deleteExpense, onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }) });

  const resetForm = () => setForm({ amount: '', category: 'Supplies', description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'CASH', vendor: '' });

  const expenses = (data?.data as any)?.expenses || data?.data || [];
  const filtered = expenses.filter((e: any) => e.description?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    createMut.mutate({ ...form, amount: parseFloat(form.amount), date: form.date || new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-colors">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Receipt size={40} className="mx-auto mb-3 opacity-50" /><p className="text-sm">No expenses yet</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((exp: any) => (
              <div key={exp.id} className="flex items-center justify-between px-4 py-3 group">
                <div>
                  <p className="text-sm font-medium text-gray-900">{exp.description}</p>
                  <p className="text-xs text-gray-400">{exp.category} · {formatDate(exp.date || exp.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-red-600">{formatCurrency(exp.amount)}</p>
                  <button onClick={() => deleteMut.mutate(exp.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add Expense</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦)</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
                  <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]">
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor (optional)</label>
                <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <button type="submit" disabled={createMut.isPending} className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Add Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
