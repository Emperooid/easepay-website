'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices, createInvoice, updateInvoiceStatus, deleteInvoice, sendInvoice, getNextInvoiceNumber } from '@/services/apiService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge, statusBadge } from '@/components/ui/Badge';
import {
  Plus, Search, Loader2, FileText, Trash2, X, Send,
  Download, MoreVertical, CheckCircle, Clock, AlertCircle,
  ChevronDown, Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUSES = ['ALL', 'PAID', 'PENDING', 'OVERDUE', 'DRAFT', 'UNPAID', 'CANCELLED'];

export default function InvoicesPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', customerAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0], dueDate: '',
    paymentMethod: 'TRANSFER', notes: '', terms: '',
    vatRate: '0', discountType: 'amount', discountValue: '0',
  });
  const [items, setItems] = useState([{ name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const qc = useQueryClient();

  const status = statusFilter === 'ALL' ? undefined : statusFilter;
  const { data, isLoading } = useQuery({ queryKey: ['invoices', status], queryFn: () => getInvoices({ status, limit: 100 }) });
  const { data: nextNumData } = useQuery({ queryKey: ['next-invoice'], queryFn: getNextInvoiceNumber, enabled: showModal });

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setShowModal(false); resetForm(); toast.success('Invoice created!'); },
    onError: (e: any) => toast.error(e.message || 'Failed to create invoice'),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => updateInvoiceStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Status updated'); setOpenMenuId(null); },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice deleted'); setOpenMenuId(null); },
    onError: () => toast.error('Failed to delete'),
  });

  const sendMut = useMutation({
    mutationFn: sendInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice sent!'); setOpenMenuId(null); },
    onError: (e: any) => toast.error(e.message || 'Failed to send invoice'),
  });

  const invoices = useMemo(() => {
    const raw = (data?.data as any)?.invoices || data?.data || [];
    if (!search) return raw;
    return raw.filter((i: any) =>
      i.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.customerEmail?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const resetForm = () => {
    setForm({ customerName: '', customerEmail: '', customerPhone: '', customerAddress: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', paymentMethod: 'TRANSFER', notes: '', terms: '', vatRate: '0', discountType: 'amount', discountValue: '0' });
    setItems([{ name: '', description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === 'name' || field === 'description' ? value : Number(value) || 0 };
      if (field === 'quantity' || field === 'unitPrice') updated.total = (field === 'quantity' ? Number(value) : item.quantity) * (field === 'unitPrice' ? Number(value) : item.unitPrice);
      return updated;
    }));
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountAmt = form.discountType === 'percent' ? subtotal * parseFloat(form.discountValue || '0') / 100 : parseFloat(form.discountValue || '0');
  const afterDiscount = subtotal - discountAmt;
  const vatAmount = afterDiscount * (parseFloat(form.vatRate || '0') / 100);
  const grandTotal = afterDiscount + vatAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(i => i.name);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    const invoiceNumber = (nextNumData?.data as any)?.invoiceNumber || `INV-${Date.now()}`;
    createMut.mutate({
      ...form, invoiceNumber,
      items: validItems.map(i => ({ name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, total: i.quantity * i.unitPrice })),
      subtotal, vatRate: parseFloat(form.vatRate),
      vatAmount, discount: discountAmt, grandTotal,
    });
  };

  // Status summary counts
  const allInvoices = (data?.data as any)?.invoices || data?.data || [];
  const counts = {
    total: allInvoices.length,
    paid: allInvoices.filter((i: any) => i.status === 'PAID').length,
    pending: allInvoices.filter((i: any) => ['PENDING', 'UNPAID'].includes(i.status)).length,
    overdue: allInvoices.filter((i: any) => i.status === 'OVERDUE').length,
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] bg-white" />
          </div>
        </div>
        <Link href="/dashboard/invoices/new" className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-all hover:shadow-md">
          <Plus size={15} /> New Invoice
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? 'bg-[#050A30] text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s === 'ALL' ? `All (${counts.total})` : s}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {!isLoading && allInvoices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Value', value: formatCurrency(allInvoices.reduce((s: number, i: any) => s + Number(i.grandTotal || i.amount || 0), 0)), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Paid', value: formatCurrency(allInvoices.filter((i: any) => i.status === 'PAID').reduce((s: number, i: any) => s + Number(i.grandTotal || i.amount || 0), 0)), icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pending', value: counts.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Overdue', value: counts.overdue, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}><Icon size={16} className={color} /></div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className={`font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText size={44} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No invoices found</p>
            <Link href="/dashboard/invoices/new" className="inline-block mt-4 px-5 py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
              Create Invoice
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Invoice #', 'Customer', 'Date', 'Due Date', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv: any) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(inv.status);
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-[#050A30] bg-[#050A30]/5 px-2 py-1 rounded">{inv.invoiceNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{inv.customerName}</p>
                        {inv.customerEmail && <p className="text-xs text-gray-400 truncate max-w-[160px]">{inv.customerEmail}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.invoiceDate || inv.createdAt)}</td>
                      <td className="px-4 py-3 text-xs">
                        {inv.dueDate ? (
                          <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}>{formatDate(inv.dueDate)}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(inv.grandTotal || inv.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadge(inv.status)}>{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center gap-1">
                          {inv.customerEmail && (
                            <button onClick={() => sendMut.mutate(inv.id)} title="Send via email"
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" disabled={sendMut.isPending}>
                              <Send size={13} />
                            </button>
                          )}
                          <button onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical size={13} />
                          </button>
                          {openMenuId === inv.id && (
                            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[180px] overflow-hidden" onClick={e => e.stopPropagation()}>
                              {['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'].map(s => (
                                <button key={s} onClick={() => statusMut.mutate({ id: inv.id, status: s })}
                                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors ${inv.status === s ? 'font-semibold text-[#050A30]' : 'text-gray-700'}`}>
                                  Mark as {s} {inv.status === s && '✓'}
                                </button>
                              ))}
                              <div className="border-t border-gray-100" />
                              <button onClick={() => { if (confirm('Delete invoice?')) deleteMut.mutate(inv.id); }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          )}
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

      {/* Click outside to close menu */}
      {openMenuId && <div className="fixed inset-0 z-0" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
