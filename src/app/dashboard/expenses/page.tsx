'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, createExpense, deleteExpense } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  Plus, Search, Loader2, Receipt, Trash2, CheckCircle2,
  Banknote, CreditCard, ArrowLeftRight, X, ShoppingBag,
  Zap, Home, Truck, Users, Megaphone, Wrench, Package,
  Coffee, Wifi, Heart, HelpCircle, MoreHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { name: 'Food & Drinks', icon: Coffee, color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { name: 'Transport', icon: Truck, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { name: 'Utilities', icon: Zap, color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  { name: 'Rent', icon: Home, color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { name: 'Salaries', icon: Users, color: 'bg-green-50 text-green-600 border-green-200' },
  { name: 'Supplies', icon: Package, color: 'bg-gray-50 text-gray-600 border-gray-200' },
  { name: 'Marketing', icon: Megaphone, color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { name: 'Maintenance', icon: Wrench, color: 'bg-red-50 text-red-600 border-red-200' },
  { name: 'Internet', icon: Wifi, color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  { name: 'Healthcare', icon: Heart, color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { name: 'Shopping', icon: ShoppingBag, color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { name: 'Other', icon: MoreHorizontal, color: 'bg-slate-50 text-slate-600 border-slate-200' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'TRANSFER', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'POS', label: 'POS/Card', icon: CreditCard },
];

type Step = 'list' | 'new' | 'success';

export default function ExpensesPage() {
  const [step, setStep] = useState<Step>('list');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState({
    amount: '', category: '', description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH', vendor: '', vatAmount: '',
  });
  const [lastExpense, setLastExpense] = useState<any>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => getExpenses({ limit: 100 }) });

  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard-home'] });
      setLastExpense(res.data || res);
      setStep('success');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add expense'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const expenses = useMemo(() => {
    const raw = (data?.data as any)?.expenses || data?.data || [];
    return raw.filter((e: any) => {
      const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()) || e.vendor?.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCategory || e.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [data, search, filterCategory]);

  const totalExpenses = useMemo(() => {
    const raw = (data?.data as any)?.expenses || data?.data || [];
    return raw.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  }, [data]);

  const resetForm = () => setForm({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'CASH', vendor: '', vatAmount: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) { toast.error('Select a category'); return; }
    createMut.mutate({
      amount: parseFloat(form.amount),
      category: form.category,
      description: form.description,
      date: form.date || new Date().toISOString(),
      paymentMethod: form.paymentMethod,
      vendor: form.vendor || undefined,
      vatAmount: form.vatAmount ? parseFloat(form.vatAmount) : undefined,
    });
  };

  if (step === 'success') {
    const catInfo = CATEGORIES.find(c => c.name === (lastExpense?.category || form.category));
    const Icon = catInfo?.icon || Receipt;
    return (
      <div className="max-w-md mx-auto py-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
          <CheckCircle2 size={44} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Expense Added!</h2>
          <p className="text-gray-500 mt-1">Recorded successfully</p>
        </div>
        <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-bold text-red-600 text-base">-{formatCurrency(lastExpense?.amount || parseFloat(form.amount))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Category</span><span className="font-medium">{lastExpense?.category || form.category}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Description</span><span className="font-medium max-w-[60%] text-right">{lastExpense?.description || form.description}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span className="font-medium">{lastExpense?.paymentMethod || form.paymentMethod}</span></div>
          {form.vendor && <div className="flex justify-between text-sm"><span className="text-gray-500">Vendor</span><span className="font-medium">{form.vendor}</span></div>}
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => { resetForm(); setStep('new'); }} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Add Another</button>
          <button onClick={() => { resetForm(); setStep('list'); }} className="flex-1 py-3 bg-[#050A30] text-white rounded-xl text-sm font-semibold hover:bg-[#0a1460] transition-colors">View All</button>
        </div>
      </div>
    );
  }

  if (step === 'new') {
    return (
      <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3">
          <button onClick={() => { resetForm(); setStep('list'); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} className="text-gray-600" /></button>
          <h2 className="text-base font-semibold text-gray-900">Add Expense</h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          {/* Category Grid */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {CATEGORIES.map(({ name, icon: Icon, color }) => (
                <button key={name} type="button" onClick={() => setForm(f => ({ ...f, category: name }))}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-xs font-medium ${form.category === name ? 'border-[#050A30] bg-[#050A30]/5 text-[#050A30]' : `border-transparent ${color} hover:opacity-90`}`}>
                  <Icon size={18} />
                  <span className="text-center leading-tight">{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₦) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₦</span>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" step="0.01" required
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">VAT Amount (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₦</span>
                <input type="number" value={form.vatAmount} onChange={e => setForm(f => ({ ...f, vatAmount: e.target.value }))} placeholder="0.00" min="0" step="0.01"
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description *</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>

          {/* Vendor + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vendor / Payee</label>
              <input type="text" value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Who did you pay?"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                <button key={value} type="button" onClick={() => setForm(f => ({ ...f, paymentMethod: value }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.paymentMethod === value ? 'border-[#050A30] bg-[#050A30] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={createMut.isPending}
            className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
            {createMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Add Expense'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={() => setStep('new')} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-all hover:shadow-md">
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* Summary */}
      {!isLoading && expenses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: (data?.data as any)?.expenses?.length || 0, color: 'text-gray-900' },
            { label: 'Spent', value: formatCurrency(totalExpenses), color: 'text-red-600' },
            { label: 'Today', value: ((data?.data as any)?.expenses || []).filter((e: any) => new Date(e.date || e.createdAt).toDateString() === new Date().toDateString()).length, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-400 font-medium">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt size={44} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No expenses yet</p>
            <p className="text-sm mt-1">Start tracking your business spending</p>
            <button onClick={() => setStep('new')} className="mt-4 px-5 py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
              Add Expense
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {expenses.map((exp: any) => {
              const catInfo = CATEGORIES.find(c => c.name === exp.category);
              const Icon = catInfo?.icon || HelpCircle;
              return (
                <div key={exp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${catInfo?.color || 'bg-gray-100 text-gray-500'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                    <p className="text-xs text-gray-400">{exp.category} {exp.vendor ? `· ${exp.vendor}` : ''} · {formatDate(exp.date || exp.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{exp.paymentMethod || 'CASH'}</span>
                    <p className="text-sm font-bold text-red-600">-{formatCurrency(exp.amount)}</p>
                    <button onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(exp.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
