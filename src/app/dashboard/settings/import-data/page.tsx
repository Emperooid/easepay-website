'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importInventory } from '@/services/apiService';
import { ChevronLeft, Upload, FileText, CheckCircle2, Loader2, AlertTriangle, X, Table2, Download } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

type ImportStep = 'idle' | 'preview' | 'importing' | 'done';

interface PreviewRow {
  name: string;
  category: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  unit: string;
  valid: boolean;
  error?: string;
}

export default function ImportDataPage() {
  const [step, setStep] = useState<ImportStep>('idle');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importCount, setImportCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: (items: any[]) => importInventory(items),
    onSuccess: (res: any) => {
      const count = res?.data?.imported || preview.filter(r => r.valid).length;
      setImportCount(count);
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setStep('done');
    },
    onError: (e: any) => { toast.error(e.message || 'Import failed'); setStep('preview'); },
  });

  const parseCSV = (text: string): PreviewRow[] => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
    return lines.slice(1).map((line, idx) => {
      const cols = line.split(',');
      const get = (keys: string[]) => {
        for (const k of keys) {
          const i = headers.indexOf(k);
          if (i !== -1) return cols[i]?.trim() || '';
        }
        return '';
      };
      const name = get(['name', 'product', 'productname', 'item']);
      const category = get(['category', 'cat', 'type']) || 'Uncategorized';
      const unitPrice = parseFloat(get(['unitprice', 'sellingprice', 'price', 'sp'])) || 0;
      const costPrice = parseFloat(get(['costprice', 'cost', 'cp'])) || 0;
      const quantity = parseInt(get(['quantity', 'qty', 'stock', 'instock'])) || 0;
      const unit = get(['unit', 'uom']) || 'pcs';
      const valid = !!name && unitPrice >= 0;
      const error = !name ? 'Missing name' : unitPrice < 0 ? 'Invalid price' : undefined;
      return { name, category, unitPrice, costPrice, quantity, unit, valid, error };
    }).filter(r => r.name || r.unitPrice);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) { toast.error('Please upload a CSV file'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { toast.error('No valid data found in CSV'); return; }
      setPreview(rows);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    const validRows = preview.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }
    setStep('importing');
    importMut.mutate(validRows.map(r => ({ name: r.name, category: r.category, unitPrice: r.unitPrice, costPrice: r.costPrice, quantity: r.quantity, unit: r.unit })));
  };

  const downloadTemplate = () => {
    const csv = 'name,category,unitPrice,costPrice,quantity,unit\nProduct A,Electronics,5000,3000,100,pcs\nProduct B,Clothing,2000,1200,50,pcs\nProduct C,Food & Drink,500,300,200,kg';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'easepay_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = preview.filter(r => r.valid).length;
  const invalidCount = preview.filter(r => !r.valid).length;

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto py-10 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle2 size={44} className="text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Import Complete!</h2>
          <p className="text-gray-500 mt-1">{importCount} product{importCount !== 1 ? 's' : ''} imported successfully</p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={() => { setStep('idle'); setPreview([]); setFileName(''); }}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Import More
          </button>
          <Link href="/dashboard/stock" className="flex-1 py-3 bg-[#050A30] text-white rounded-xl text-sm font-semibold text-center hover:bg-[#0a1460] transition-colors">
            View Stock
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="max-w-md mx-auto py-16 flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-[#050A30]/5 flex items-center justify-center">
          <Loader2 size={36} className="animate-spin text-[#050A30]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Importing...</h2>
          <p className="text-gray-400 text-sm mt-1">Adding {validCount} products to your inventory</p>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button onClick={() => { setStep('idle'); setPreview([]); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></button>
          <div>
            <h1 className="text-base font-bold text-gray-900">Preview Import</h1>
            <p className="text-xs text-gray-400">{fileName}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{validCount}</p>
            <p className="text-xs text-green-700 font-medium">Ready to import</p>
          </div>
          {invalidCount > 0 && (
            <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
              <p className="text-xs text-red-700 font-medium">Will be skipped</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs min-w-[540px]">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Name</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Category</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500">Price</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-500">Qty</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.map((row, i) => (
                  <tr key={i} className={row.valid ? 'hover:bg-gray-50' : 'bg-red-50/50'}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                    <td className="px-3 py-2 text-gray-500">{row.category}</td>
                    <td className="px-3 py-2 text-right text-gray-700">₦{row.unitPrice.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{row.quantity}</td>
                    <td className="px-3 py-2 text-center">
                      {row.valid ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      ) : (
                        <span className="text-red-500 text-xs" title={row.error}><AlertTriangle size={12} /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button onClick={handleImport} disabled={validCount === 0}
          className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#0a1460] transition-colors">
          Import {validCount} Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Import Data</h1>
          <p className="text-xs text-gray-400">Import products from a CSV file</p>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <div
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#050A30] p-10 flex flex-col items-center gap-4 cursor-pointer transition-all hover:bg-gray-50 group"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#050A30]/5 group-hover:bg-[#050A30]/10 flex items-center justify-center transition-colors">
          <Upload size={28} className="text-[#050A30]" />
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900">Drop your CSV file here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse</p>
        </div>
        <p className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">CSV files only</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Table2 size={15} /> CSV Format</h3>
        <p className="text-xs text-gray-500">Your CSV file should have these columns:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[['name *', 'Product name'], ['category', 'Product category'], ['unitPrice', 'Selling price (₦)'], ['costPrice', 'Cost price (₦)'], ['quantity', 'Stock quantity'], ['unit', 'Unit (pcs, kg...)']].map(([col, desc]) => (
            <div key={col} className="flex items-start gap-1.5 text-xs">
              <code className="bg-gray-100 text-[#050A30] px-1.5 py-0.5 rounded font-mono text-xs flex-shrink-0">{col}</code>
              <span className="text-gray-500 pt-0.5">{desc}</span>
            </div>
          ))}
        </div>
        <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs font-semibold text-[#050A30] hover:underline mt-2">
          <Download size={13} /> Download template CSV
        </button>
      </div>
    </div>
  );
}
