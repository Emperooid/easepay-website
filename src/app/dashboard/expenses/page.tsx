'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { getExpenses, createExpense, deleteExpense, updateExpense, getExpense } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  Plus, Search, Loader2, Receipt, Trash2, CheckCircle2,
  Banknote, CreditCard, ArrowLeftRight, X, ShoppingBag,
  Zap, Home, Truck, Users, Megaphone, Wrench, Package,
  Wifi, HelpCircle, MoreHorizontal,
  ChevronLeft, ChevronRight, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/context/SubscriptionContext';
import { AccessRestricted } from '@/components/ui/AccessRestricted';
import Link from 'next/link';

// Categories aligned with mobile AddExpenseScreen — id is the stored value
const CATEGORIES = [
  { id: 'rent',        name: 'Rent / Lease',       icon: Home,            color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { id: 'inventory',   name: 'Inventory',           icon: Package,         color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'electricity', name: 'Electricity',         icon: Zap,             color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  { id: 'salaries',    name: 'Salaries',            icon: Users,           color: 'bg-green-50 text-green-600 border-green-200' },
  { id: 'transport',   name: 'Transport',           icon: Truck,           color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'marketing',   name: 'Marketing',           icon: Megaphone,       color: 'bg-pink-50 text-pink-600 border-pink-200' },
  { id: 'equipment',   name: 'Equipment',           icon: Wrench,          color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { id: 'internet',    name: 'Internet / Telecom',  icon: Wifi,            color: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  { id: 'office',      name: 'Office Supplies',     icon: ShoppingBag,     color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { id: 'maintenance', name: 'Maintenance',         icon: Wrench,          color: 'bg-red-50 text-red-600 border-red-200' },
  { id: 'tax',         name: 'Tax / Levies',        icon: Receipt,         color: 'bg-slate-50 text-slate-600 border-slate-200' },
  { id: 'others',      name: 'Others',              icon: MoreHorizontal,  color: 'bg-gray-50 text-gray-600 border-gray-200' },
];

function getCatInfo(category: string | undefined) {
  if (!category) return undefined;
  return CATEGORIES.find(c => c.id === category || c.name.toLowerCase() === category.toLowerCase());
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'TRANSFER', label: 'Transfer', icon: ArrowLeftRight },
  { value: 'POS', label: 'POS/Card', icon: CreditCard },
];

const PAGE_SIZE = 20;

function getPageNums(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4)          return [1, 2, 3, 4, 5, '…', total];
  if (cur >= total - 3)  return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', cur - 1, cur, cur + 1, '…', total];
}

type Step = 'list' | 'new' | 'success';

export default function ExpensesPage() {
  const { isOwner, can } = usePermissions();
  const { isTransactionBlocked, isTrialExpired } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('editId');
  const isEditing = !!editId;

  const [step, setStep] = useState<Step>(editId ? 'new' : 'list');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    amount: '', category: '', description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH', vendor: '', vatAmount: '',
  });
  const [lastExpense, setLastExpense] = useState<any>(null);
  const qc = useQueryClient();

  // Load existing expense data when editing
  useEffect(() => {
    if (!editId) return;
    getExpense(editId).then((res: any) => {
      const d = res?.data?.expense || res?.data || res?.expense || res;
      if (!d) return;
      setForm({
        amount: String(d.amount || ''),
        category: d.category || '',
        description: d.description || '',
        date: d.date ? d.date.split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMethod: d.paymentMethod || 'CASH',
        vendor: d.vendor || '',
        vatAmount: d.vatAmount ? String(d.vatAmount) : '',
      });
    }).catch(() => {});
  }, [editId]);

  const { data, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => getExpenses({ limit: 100 }) });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['expenses'] });
    qc.invalidateQueries({ queryKey: ['expenses-all'] });
    qc.invalidateQueries({ queryKey: ['expenses-recent'] });
    qc.invalidateQueries({ queryKey: ['dashboard-home'] });
  };

  const updateMut = useMutation({
    mutationFn: (data: any) => updateExpense(editId!, data),
    onSuccess: (res: any) => {
      if (!res?.success && res?.message) { toast.error(res.message); return; }
      invalidateAll();
      toast.success('Expense updated!');
      router.push(`/dashboard/transactions/expense/${editId}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update expense'),
  });

  const createMut = useMutation({
    mutationFn: createExpense,
    onSuccess: (res) => {
      if (!res.success) return;
      invalidateAll();
      setLastExpense(res.data || res);
      setStep('success');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add expense'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => { invalidateAll(); toast.success('Expense deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const allExpenses = useMemo(() => {
    const raw = (data?.data as any)?.expenses || (data as any)?.expenses || data?.data || [];
    return raw.filter((e: any) => {
      const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()) || e.vendor?.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCategory || e.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [data, search, filterCategory]);

  const totalPages = Math.max(1, Math.ceil(allExpenses.length / PAGE_SIZE));
  const expenses = allExpenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalExpenses = useMemo(() => {
    const raw = (data?.data as any)?.expenses || (data as any)?.expenses || data?.data || [];
    return raw.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  }, [data]);

  const resetForm = () => setForm({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'CASH', vendor: '', vatAmount: '' });

  const [vatOverrideConfirmed, setVatOverrideConfirmed] = useState(false);

  const submitExpense = () => {
    const catName = getCatInfo(form.category)?.name || form.category;
    const payload = {
      amount: parseFloat(form.amount),
      category: form.category,
      description: form.description.trim() || `${catName} expense`,
      date: form.date || new Date().toISOString(),
      paymentMethod: form.paymentMethod,
      vendor: form.vendor || undefined,
      vatAmount: form.vatAmount ? parseFloat(form.vatAmount) : undefined,
    };
    if (isEditing) updateMut.mutate(payload);
    else createMut.mutate(payload);
    setVatOverrideConfirmed(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMut.isPending) return;
    if (!form.category) { toast.error('Select a category'); return; }

    const expAmount = parseFloat(form.amount) || 0;

    // Balance validation — same logic as mobile's AsyncStorage check
    const isCash = form.paymentMethod === 'CASH';
    const computedKey = isCash ? 'computed_cash_in_hand' : 'computed_cash_in_bank';
    const startingKey = isCash ? 'starting_cash_balance' : 'starting_bank_balance';
    const computedRaw = localStorage.getItem(computedKey);
    const startingRaw = localStorage.getItem(startingKey);

    if (computedRaw !== null || startingRaw !== null) {
      const available = computedRaw !== null ? (parseFloat(computedRaw) || 0) : (parseFloat(startingRaw!) || 0);
      if (expAmount > available) {
        const label = isCash ? 'cash at hand' : 'bank balance';
        toast.error(`Insufficient balance. You are spending ${formatCurrency(expAmount)} but your available ${label} is ${formatCurrency(available)}.`);
        return;
      }
    }

    // VAT validation — warn if VAT payout exceeds net VAT collected
    const vatEntered = parseFloat(form.vatAmount || '0') || 0;
    if (vatEntered > 0 && !vatOverrideConfirmed) {
      const vatBalanceRaw = localStorage.getItem('computed_vat_net_balance');
      if (vatBalanceRaw !== null) {
        const vatBalance = parseFloat(vatBalanceRaw) || 0;
        if (vatEntered > vatBalance) {
          const cont = window.confirm(
            `VAT Balance Exceeded\n\nThe VAT amount (${formatCurrency(vatEntered)}) is higher than your available VAT balance (${formatCurrency(vatBalance)}).\n\nYou may have collected less VAT than you are paying out.\n\nAdd anyway?`
          );
          if (!cont) return;
          setVatOverrideConfirmed(true);
        }
      }
    }

    submitExpense();
  };

  if (step === 'success') {
    const catInfo = getCatInfo(lastExpense?.category || form.category);
    const Icon = catInfo?.icon || Receipt;
    return (
      <div className="max-w-sm mx-auto py-6 flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Expense Added!</h2>
          <p className="text-gray-500 text-sm mt-0.5">Recorded successfully</p>
        </div>
        <div className="w-full bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-bold text-red-600">-{formatCurrency(lastExpense?.amount || parseFloat(form.amount))}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Category</span><span className="font-medium">{catInfo?.name || lastExpense?.category || form.category}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Description</span><span className="font-medium max-w-[60%] text-right">{lastExpense?.description || form.description}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Payment</span><span className="font-medium">{lastExpense?.paymentMethod || form.paymentMethod}</span></div>
          {form.vendor && <div className="flex justify-between text-sm"><span className="text-gray-500">Vendor</span><span className="font-medium">{form.vendor}</span></div>}
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => { resetForm(); setStep('new'); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Add Another</button>
          <button onClick={() => { resetForm(); setStep('list'); }} className="flex-1 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">View All</button>
        </div>
      </div>
    );
  }

  if (step === 'new' && !isOwner && !can('manage_expenses')) {
    return <AccessRestricted message="You don't have permission to record expenses." />;
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
            ? 'Your 30-day free trial has ended. Subscribe to continue recording expenses.'
            : 'Your subscription has expired. Renew to continue recording expenses.'}
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
      <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3">
          <button onClick={() => { resetForm(); setStep('list'); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} className="text-gray-600" /></button>
          <h2 className="text-base font-semibold text-gray-900">{isEditing ? 'Edit Expense' : 'Add Expense'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          {/* Category Grid */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {CATEGORIES.map(({ id, name, icon: Icon, color }) => (
                <button key={id} type="button" onClick={() => setForm(f => ({ ...f, category: id }))}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-xs font-medium ${form.category === id ? 'border-[#050A30] bg-[#050A30]/5 text-[#050A30]' : `border-transparent ${color} hover:opacity-90`}`}>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (Optional)</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Monthly rent, generator fuel, staff feeding..."
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

          <button type="submit" disabled={createMut.isPending || updateMut.isPending}
            className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
            {(createMut.isPending || updateMut.isPending) ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : isEditing ? 'Save Changes' : 'Add Expense'}
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
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search expenses..." className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white" />
          </div>
          <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }} className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            { label: 'Total', value: (data?.data as any)?.expenses?.length || expenses.length, color: 'text-gray-900' },
            { label: 'Spent', value: formatCurrency(totalExpenses), color: 'text-red-600' },
            { label: 'Today', value: ((data?.data as any)?.expenses || expenses).filter((e: any) => new Date(e.date || e.createdAt).toDateString() === new Date().toDateString()).length, color: 'text-blue-600' },
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
        ) : expenses.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Receipt size={32} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium text-gray-500 text-sm">No expenses yet</p>
            <p className="text-xs mt-1">Start tracking your business spending</p>
            <button onClick={() => setStep('new')} className="mt-3 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
              Add Expense
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {expenses.map((exp: any) => {
                const catInfo = getCatInfo(exp.category);
                const Icon = catInfo?.icon || HelpCircle;
                return (
                  <div key={exp.id || exp._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group cursor-pointer" onClick={() => window.location.href = `/dashboard/transactions/expense/${exp.id || exp._id}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${catInfo?.color || 'bg-gray-100 text-gray-500'}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                      <p className="text-xs text-gray-400">{catInfo?.name || exp.category} {exp.vendor ? `· ${exp.vendor}` : ''} · {formatDate(exp.date || exp.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{exp.paymentMethod || 'CASH'}</span>
                      <p className="text-sm font-bold text-red-600">-{formatCurrency(exp.amount)}</p>
                      <button onClick={e => { e.stopPropagation(); if (confirm('Delete this expense?')) deleteMut.mutate(exp.id || exp._id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allExpenses.length)} of {allExpenses.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {getPageNums(page, totalPages).map((n, i) =>
                    n === '…' ? (
                      <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
                    ) : (
                      <button key={n} onClick={() => setPage(Number(n))}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          page === n ? 'bg-[#050A30] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}>
                        {n}
                      </button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
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
