'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'custom_unit_options';

const DEFAULTS = [
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

interface Unit { label: string; value: string; }

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [label, setLabel] = useState('');
  const [abbr, setAbbr]   = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editAbbr,  setEditAbbr]  = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setUnits(raw ? JSON.parse(raw) : DEFAULTS);
    } catch {
      setUnits(DEFAULTS);
    }
  }, []);

  const save = (list: Unit[]) => {
    setUnits(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const add = () => {
    const l = label.trim();
    const v = abbr.trim() || l;
    if (!l) return;
    if (units.some(u => u.value.toLowerCase() === v.toLowerCase())) { toast.error('Unit already exists'); return; }
    save([...units, { label: l, value: v }]);
    setLabel(''); setAbbr('');
    toast.success('Unit added');
  };

  const remove = (idx: number) => {
    if (!confirm(`Remove "${units[idx].label}"?`)) return;
    save(units.filter((_, i) => i !== idx));
    toast.success('Unit removed');
  };

  const startEdit = (idx: number) => { setEditIdx(idx); setEditLabel(units[idx].label); setEditAbbr(units[idx].value); };

  const commitEdit = () => {
    if (editIdx === null) return;
    const l = editLabel.trim();
    const v = editAbbr.trim() || l;
    if (!l) { setEditIdx(null); return; }
    const next = [...units];
    next[editIdx] = { label: l, value: v };
    save(next);
    setEditIdx(null);
    toast.success('Updated');
  };

  const reset = () => {
    if (!confirm('Reset to default units?')) return;
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
          <h1 className="text-base font-bold text-gray-900">Measuring Units</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage units of measurement used in your inventory.</p>
        </div>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Unit name (e.g. Bundles)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]"
        />
        <input
          value={abbr}
          onChange={e => setAbbr(e.target.value)}
          placeholder="Abbr. (optional)"
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]"
        />
        <button onClick={add}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
          <Plus size={14} /> Add
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {units.map((u, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              {editIdx === idx ? (
                <>
                  <input
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditIdx(null); }}
                    autoFocus
                    placeholder="Label"
                    className="flex-1 px-2 py-1 border border-[#050A30] rounded-lg text-sm focus:outline-none"
                  />
                  <input
                    value={editAbbr}
                    onChange={e => setEditAbbr(e.target.value)}
                    placeholder="Abbr."
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none"
                  />
                  <button onClick={commitEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"><Check size={14} /></button>
                  <button onClick={() => setEditIdx(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{u.label}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">{u.value}</span>
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
