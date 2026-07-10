'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'custom_item_categories';

const DEFAULTS = [
  'General', 'Food & Beverages', 'Electronics', 'Clothing & Fashion',
  'Health & Beauty', 'Home & Garden', 'Sports & Fitness', 'Automotive',
  'Books & Stationery', 'Liquid', 'Other',
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setCategories(raw ? JSON.parse(raw) : DEFAULTS);
    } catch {
      setCategories(DEFAULTS);
    }
  }, []);

  const save = (list: string[]) => {
    setCategories(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) { toast.error('Category already exists'); return; }
    save([...categories, trimmed]);
    setInput('');
    toast.success('Category added');
  };

  const remove = (idx: number) => {
    if (!confirm(`Remove "${categories[idx]}"?`)) return;
    save(categories.filter((_, i) => i !== idx));
    toast.success('Category removed');
  };

  const startEdit = (idx: number) => { setEditIdx(idx); setEditVal(categories[idx]); };

  const commitEdit = () => {
    if (editIdx === null) return;
    const trimmed = editVal.trim();
    if (!trimmed) { setEditIdx(null); return; }
    if (categories.some((c, i) => i !== editIdx && c === trimmed)) { toast.error('Already exists'); return; }
    const next = [...categories];
    next[editIdx] = trimmed;
    save(next);
    setEditIdx(null);
    toast.success('Updated');
  };

  const reset = () => {
    if (!confirm('Reset to default categories?')) return;
    save(DEFAULTS);
    toast.success('Reset to defaults');
  };

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Item Categories</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage product categories used in your inventory.</p>
        </div>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="New category name..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]"
        />
        <button onClick={add}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
          <Plus size={14} /> Add
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              {editIdx === idx ? (
                <>
                  <input
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }}
                    autoFocus
                    className="flex-1 px-2 py-1 border border-[#050A30] rounded-lg text-sm focus:outline-none"
                  />
                  <button onClick={commitEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditIdx(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{cat}</span>
                  <button onClick={() => startEdit(idx)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => remove(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 hover:underline transition-colors">
        Reset to defaults
      </button>
    </div>
  );
}
