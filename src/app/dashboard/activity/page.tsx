'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getSales, getExpenses, getInvoices, getInventory } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShoppingCart, Receipt, FileText, Package,
  ChevronRight, ChevronLeft, Search, X, Loader2,
} from 'lucide-react';

const PAGE_SIZE = 20;

const TYPE_CONFIG = {
  sale:    { label: 'Sale',    icon: ShoppingCart, bg: 'bg-green-50',  color: 'text-green-600',  amtColor: 'text-green-600',  prefix: '+' },
  invoice: { label: 'Invoice', icon: FileText,     bg: 'bg-blue-50',   color: 'text-blue-600',   amtColor: 'text-blue-600',   prefix: '+' },
  expense: { label: 'Expense', icon: Receipt,      bg: 'bg-red-50',    color: 'text-red-500',    amtColor: 'text-red-500',    prefix: '-' },
  stock:   { label: 'Stock',   icon: Package,      bg: 'bg-purple-50', color: 'text-purple-600', amtColor: 'text-gray-500',   prefix: '' },
};

const TYPE_FILTERS = ['All', 'Sales', 'Invoices', 'Expenses', 'Stock'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

function getPageNums(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total];
  if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', cur - 1, cur, cur + 1, '…', total];
}

export default function ActivityPage() {
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [page, setPage]             = useState(1);

  const { data: salesData,   isLoading: sl } = useQuery({ queryKey: ['sales-all'],     queryFn: () => getSales({ limit: 1000 }),     staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true });
  const { data: invData,     isLoading: il } = useQuery({ queryKey: ['invoices-all'],  queryFn: () => getInvoices({ limit: 1000 }),  staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true });
  const { data: expData,     isLoading: el } = useQuery({ queryKey: ['expenses-all'],  queryFn: () => getExpenses({ limit: 1000 }),  staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true });
  const { data: stockData             } = useQuery({ queryKey: ['inventory-recent'], queryFn: () => getInventory({ limit: 500 }),  staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true });

  const isLoading = sl || il || el;

  const sales:    any[] = (salesData?.data as any)?.sales    || (salesData as any)?.sales    || salesData?.data    || [];
  const invoices: any[] = (invData?.data   as any)?.invoices || (invData   as any)?.invoices || invData?.data      || [];
  const expenses: any[] = (expData?.data   as any)?.expenses || (expData   as any)?.expenses || expData?.data      || [];
  const stock:    any[] = (stockData?.data as any)?.items    || (stockData as any)?.items    || stockData?.data    || [];

  const all = useMemo(() => [
    ...sales.map((s: any) => ({
      _key: `sale-${s.id}`, _type: 'sale' as const, _id: s.id,
      _ts: new Date(s.createdAt || s.date || 0).getTime(),
      label: s.customerName || 'Walk-in customer',
      subLabel: s.items?.map((i: any) => i.name).join(', ') || s.description || '',
      amount: parseFloat(s.amount || 0),
      paymentMethod: s.paymentMethod,
      date: s.createdAt || s.date,
    })),
    ...invoices.map((inv: any) => ({
      _key: `inv-${inv.id}`, _type: 'invoice' as const, _id: inv.id,
      _ts: new Date(inv.createdAt || inv.invoiceDate || inv.date || 0).getTime(),
      label: inv.customerName || `Invoice #${inv.invoiceNumber || ''}`,
      subLabel: inv.invoiceNumber ? `#${inv.invoiceNumber}` : '',
      amount: parseFloat(inv.grandTotal || inv.total || inv.amount || 0),
      paymentMethod: inv.paymentMethod,
      date: inv.createdAt || inv.invoiceDate || inv.date,
      status: inv.status,
    })),
    ...expenses.map((e: any) => ({
      _key: `exp-${e.id}`, _type: 'expense' as const, _id: e.id,
      _ts: new Date(e.createdAt || e.date || 0).getTime(),
      label: e.description || e.category || 'Expense',
      subLabel: e.category || '',
      amount: parseFloat(e.amount || 0),
      paymentMethod: e.paymentMethod,
      date: e.createdAt || e.date,
    })),
    ...stock.map((s: any) => ({
      _key: `stock-${s.id}`, _type: 'stock' as const, _id: s.id,
      _ts: new Date(s.createdAt || s.updatedAt || 0).getTime(),
      label: s.name || 'Inventory Item',
      subLabel: `${s.category || 'Stock'} · ${s.quantity ?? 0} units`,
      amount: parseFloat(s.costPrice || s.cost || 0) * parseFloat(s.quantity || 1),
      paymentMethod: undefined,
      date: s.createdAt || s.updatedAt,
      status: undefined,
    })),
  ].sort((a, b) => b._ts - a._ts), [sales, invoices, expenses, stock]);

  const filtered = useMemo(() => {
    let items = all;

    if (typeFilter !== 'All') {
      const map: Record<TypeFilter, string> = { All: '', Sales: 'sale', Invoices: 'invoice', Expenses: 'expense', Stock: 'stock' };
      items = items.filter(i => i._type === map[typeFilter]);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.label.toLowerCase().includes(q) ||
        i.subLabel.toLowerCase().includes(q) ||
        i._type.includes(q) ||
        (i.paymentMethod || '').toLowerCase().includes(q)
      );
    }

    return items;
  }, [all, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleType   = (v: TypeFilter) => { setTypeFilter(v); setPage(1); };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-gray-900">All Activity</h1>
          <p className="text-xs text-gray-400 mt-0.5">{all.length} total records</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by name, type, payment method…"
          className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#050A30]/20 focus:border-[#050A30]/40"
        />
        {search && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => handleType(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              typeFilter === f
                ? 'bg-[#050A30] text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-300" size={28} />
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm font-medium">No records found</p>
            {(search || typeFilter !== 'All') && (
              <button
                onClick={() => { handleSearch(''); handleType('All'); }}
                className="mt-2 text-xs text-[#050A30] font-semibold hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {paged.map(item => {
              const cfg = TYPE_CONFIG[item._type];
              const Icon = cfg.icon;
              const isClickable = item._type !== 'stock';
              const href = isClickable ? `/dashboard/transactions/${item._type}/${item._id}` : null;

              const content = (
                <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isClickable ? 'hover:bg-[#050A30]/5 cursor-pointer group' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <Icon size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.label}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {(item as any).status && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 bg-gray-100 text-gray-500">
                          {(item as any).status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
                      {item.paymentMethod && (
                        <span className="text-[10px] text-gray-400">· {item.paymentMethod}</span>
                      )}
                      {item.subLabel && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[140px]">· {item.subLabel}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <p className={`text-sm font-bold ${cfg.amtColor}`}>
                      {cfg.prefix}{formatCurrency(item.amount)}
                    </p>
                    {isClickable && <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />}
                  </div>
                </div>
              );

              return href ? (
                <Link key={item._key} href={href}>{content}</Link>
              ) : (
                <div key={item._key}>{content}</div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-400">
                  Page {page} of {totalPages} · {filtered.length} records
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {getPageNums(page, totalPages).map((n, i) =>
                    typeof n === 'number' ? (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-colors ${
                          page === n ? 'bg-[#050A30] text-white' : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ) : (
                      <span key={`e${i}`} className="w-7 text-center text-xs text-gray-400 select-none">{n}</span>
                    )
                  )}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={13} />
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
