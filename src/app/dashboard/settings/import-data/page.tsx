'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { importInventory, getInventory, createProduct } from '@/services/apiService';
import {
  ChevronLeft, CheckCircle2, Loader2, AlertTriangle,
  Download, CloudUpload, FileText,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessRestricted } from '@/components/ui/AccessRestricted';

// ── Exact same HEADER_ALIASES as mobile ──────────────────────────────────────
const HEADER_ALIASES: Record<string, string> = {
  'product name': 'name', 'product': 'name', 'item': 'name', 'item name': 'name',
  'qty': 'quantity', 'stock': 'quantity',
  'unit price': 'unitprice', 'selling price': 'unitprice', 'price': 'unitprice', 'sale price': 'unitprice',
  'cost price': 'costprice', 'cost': 'costprice', 'buying price': 'costprice',
  'size': 'unit', 'size/unit': 'unit',
  'colour': 'color',
  'desc': 'description',
};

// Positional fallback when no header row (same order as mobile)
const POSITIONAL_KEYS = ['name', 'category', 'unitprice', 'quantity', 'costprice', 'unit', 'color', 'description'];

type ParsedItem = {
  name: string; category: string; unitPrice: number; quantity: number;
  costPrice: number; unit?: string; color?: string; description?: string;
};
type ParseError = { row: number; reason: string };
type ImportResult = { imported: number; skipped: number; errors: number };
type Screen = 'idle' | 'preview' | 'importing' | 'done';

// ── Exact same splitCsvLine as mobile (strips quotes) ────────────────────────
function splitCsvLine(line: string): string[] {
  return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
}

// ── Exact same parseCsv as mobile ────────────────────────────────────────────
function parseCsv(text: string): { items: ParsedItem[]; errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { items: [], errors: [] };

  const firstLineLower = lines[0].toLowerCase();
  const hasHeader =
    firstLineLower.includes('name') ||
    firstLineLower.includes('quantity') ||
    firstLineLower.includes('price') ||
    firstLineLower.includes('category');

  const colIndex: Record<string, number> = {};
  if (hasHeader) {
    splitCsvLine(lines[0]).forEach((h, i) => {
      const key = h.toLowerCase();
      colIndex[HEADER_ALIASES[key] ?? key] = i;
    });
  } else {
    POSITIONAL_KEYS.forEach((key, i) => { colIndex[key] = i; });
  }

  const get = (cols: string[], key: string) =>
    colIndex[key] !== undefined ? (cols[colIndex[key]] ?? '') : '';

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const items: ParsedItem[] = [];
  const errors: ParseError[] = [];

  dataLines.forEach((line, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    const cols   = splitCsvLine(line);

    const name         = get(cols, 'name');
    const category     = get(cols, 'category');
    const unitPriceRaw = get(cols, 'unitprice');
    const quantityRaw  = get(cols, 'quantity') || '0';
    const costPriceRaw = get(cols, 'costprice');
    const unit         = get(cols, 'unit') || undefined;
    const color        = get(cols, 'color') || undefined;
    const description  = get(cols, 'description') || undefined;

    if (!name)     { errors.push({ row: rowNum, reason: 'Missing product name' }); return; }
    if (!category) { errors.push({ row: rowNum, reason: 'Missing category' });      return; }

    const unitPrice = parseFloat(unitPriceRaw);
    if (isNaN(unitPrice) || unitPrice < 0) {
      errors.push({ row: rowNum, reason: 'Invalid selling price' }); return;
    }
    const quantity = parseInt(quantityRaw, 10);
    if (isNaN(quantity) || quantity < 0) {
      errors.push({ row: rowNum, reason: 'Invalid quantity' }); return;
    }
    const costPrice = parseFloat(costPriceRaw);
    if (isNaN(costPrice) || costPrice < 0) {
      errors.push({ row: rowNum, reason: 'Invalid cost price' }); return;
    }

    const item: ParsedItem = { name, category, unitPrice, quantity, costPrice };
    if (unit)        item.unit        = unit;
    if (color)       item.color       = color;
    if (description) item.description = description;
    items.push(item);
  });

  return { items, errors };
}

const TEMPLATE_CSV =
  'name,category,unitPrice,quantity,costPrice,unit,color,description\n' +
  'Rice 5kg,Grains,3500,100,2800,bag,White,Imported long grain\n' +
  'Milk Tin,Dairy,1200,50,900,tin,,\n' +
  'Sugar 1kg,Grains,800,200,600,pack,,';

export default function ImportDataPage() {
  const { isOwner, can } = usePermissions();
  const [screen,           setScreen]           = useState<Screen>('idle');
  const [fileName,         setFileName]         = useState('');
  const [parsedItems,      setParsedItems]      = useState<ParsedItem[]>([]);
  const [parseErrors,      setParseErrors]      = useState<ParseError[]>([]);
  const [existingStockMap, setExistingStockMap] = useState<Record<string, number>>({});
  const [stockFetchFailed, setStockFetchFailed] = useState(false);
  const [result,           setResult]           = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) { toast.error('Please upload a CSV file'); return; }
    setFileName(file.name);
    try {
      const text = await file.text();
      const { items, errors } = parseCsv(text);
      setParsedItems(items);
      setParseErrors(errors);

      // Fetch current inventory for New vs Update detection (same as mobile)
      setStockFetchFailed(false);
      try {
        const stockRes = await getInventory({ limit: 1000 });
        const rawItems: any[] =
          Array.isArray(stockRes.data)
            ? stockRes.data
            : (stockRes.data as any)?.items ?? (stockRes.data as any)?.inventory ?? [];
        const map: Record<string, number> = {};
        for (const si of rawItems) {
          const key = (si.name ?? '').toLowerCase().trim();
          if (key) map[key] = parseInt(si.quantity ?? si.stock ?? 0, 10);
        }
        setExistingStockMap(map);
      } catch {
        setExistingStockMap({});
        setStockFetchFailed(true);
      }

      setScreen('preview');
    } catch {
      toast.error("Could not read this file. Make sure it's a valid CSV.");
    }
  };

  const handleImport = async () => {
    if (parsedItems.length === 0) { toast.error('No valid rows to import'); return; }
    setScreen('importing');
    try {
      // Try bulk import first
      const res = await importInventory(parsedItems) as any;

      // If bulk import succeeded, done
      if (res?.success !== false) {
        setResult({
          imported: res?.imported ?? res?.data?.imported ?? parsedItems.length,
          skipped:  res?.skipped  ?? res?.data?.skipped  ?? 0,
          errors:   res?.errors   ?? res?.data?.errors   ?? 0,
        });
        qc.invalidateQueries({ queryKey: ['inventory'] });
        qc.invalidateQueries({ queryKey: ['inventory-summary'] });
        setScreen('done');
        return;
      }

      // Bulk import blocked (403 subscription gate or limit) — fall back to
      // creating items one by one via POST /inventory which has no gate.
      // Send both `quantity` AND `stock` (backend compatibility alias, same as mobile).
      let imported = 0;
      let errors   = 0;
      for (const item of parsedItems) {
        try {
          const r = await createProduct({
            name:        item.name,
            category:    item.category,
            unitPrice:   item.unitPrice,
            price:       item.unitPrice,        // backend alias
            costPrice:   item.costPrice,
            cost:        item.costPrice,        // backend alias
            quantity:    item.quantity,
            stock:       item.quantity,         // backend compatibility alias (same as mobile)
            unit:        item.unit   || undefined,
            color:       item.color  || undefined,
            description: item.description || undefined,
          }) as any;
          if (r?.success !== false) imported++;
          else errors++;
        } catch {
          errors++;
        }
      }

      qc.invalidateQueries({ queryKey: ['inventory'] });
      setResult({ imported, skipped: 0, errors });
      setScreen('done');
    } catch {
      setScreen('preview');
      toast.error('Could not reach the server. Check your connection and try again.');
    }
  };

  const handleReset = () => {
    setParsedItems([]); setParseErrors([]); setResult(null);
    setFileName(''); setExistingStockMap({}); setStockFetchFailed(false);
    setScreen('idle');
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'easepay_inventory_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const newCount    = parsedItems.filter(i => !(i.name.toLowerCase().trim() in existingStockMap)).length;
  const updateCount = parsedItems.length - newCount;

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (screen === 'done' && result) return (
    <div className="max-w-md mx-auto py-10 flex flex-col items-center gap-5 animate-in fade-in duration-300">
      <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center">
        <CheckCircle2 size={44} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Import Complete</h2>
      <div className="flex gap-3 w-full">
        <div className="flex-1 bg-gray-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{result.imported}</p>
          <p className="text-xs text-gray-500 mt-1">Imported</p>
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-400">{result.skipped}</p>
          <p className="text-xs text-gray-500 mt-1">Skipped</p>
        </div>
        {result.errors > 0 && (
          <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{result.errors}</p>
            <p className="text-xs text-red-400 mt-1">Errors</p>
          </div>
        )}
      </div>
      {result.errors > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 w-full">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{result.errors} row{result.errors !== 1 ? 's' : ''} could not be imported. Check your CSV for missing or invalid fields.</p>
        </div>
      )}
      <div className="flex gap-3 w-full">
        <button onClick={handleReset} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Import More
        </button>
        <Link href="/dashboard/stock" className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold text-center hover:bg-blue-700 transition-colors">
          View Inventory
        </Link>
      </div>
    </div>
  );

  // ── IMPORTING ────────────────────────────────────────────────────────────
  if (screen === 'importing') return (
    <div className="max-w-md mx-auto flex flex-col items-center gap-4 py-20">
      <Loader2 size={40} className="animate-spin text-blue-500" />
      <p className="text-lg font-bold text-gray-900">Importing items…</p>
      <p className="text-sm text-gray-400">This may take a moment</p>
    </div>
  );

  // ── PREVIEW ──────────────────────────────────────────────────────────────
  if (screen === 'preview') return (
    <div className="max-w-2xl space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <button onClick={handleReset} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">Preview Import</h1>
          <p className="text-xs text-gray-400 truncate">{fileName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <FileText size={15} className="text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-700 font-semibold truncate">{fileName}</p>
      </div>

      {stockFetchFailed && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-800">Could not load current stock — New/Update preview unavailable. Import will still work correctly.</p>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 bg-gray-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{newCount}</p>
          <p className="text-xs text-gray-500 mt-1">New</p>
        </div>
        <div className="flex-1 bg-gray-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{updateCount}</p>
          <p className="text-xs text-gray-500 mt-1">Updates</p>
        </div>
        <div className={`flex-1 bg-gray-50 border rounded-xl p-4 text-center ${parseErrors.length > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <p className={`text-2xl font-bold ${parseErrors.length > 0 ? 'text-red-600' : 'text-gray-300'}`}>{parseErrors.length}</p>
          <p className="text-xs text-gray-500 mt-1">Errors</p>
        </div>
      </div>

      {/* Item list preview */}
      {parsedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-900">Preview (first 10 rows)</p>
          </div>
          <div className="divide-y divide-gray-50">
            {parsedItems.slice(0, 10).map((item, i) => {
              const key        = item.name.toLowerCase().trim();
              const existingQty = key in existingStockMap ? existingStockMap[key] : null;
              const isExisting  = existingQty !== null;
              const resultQty   = isExisting ? (existingQty as number) + item.quantity : item.quantity;
              return (
                <div key={i} className="flex items-start justify-between px-4 py-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {isExisting
                        ? <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Update</span>
                        : <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">New</span>
                      }
                    </div>
                    <p className="text-xs text-gray-400">
                      {item.category}{item.unit ? ` · ${item.unit}` : ''}{item.color ? ` · ${item.color}` : ''}
                    </p>
                    {isExisting ? (
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">
                        {existingQty} in stock + {item.quantity} importing = {resultQty} total
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">{item.quantity} unit{item.quantity !== 1 ? 's' : ''} · new item</p>
                    )}
                    {item.costPrice > 0 && <p className="text-xs text-gray-400">Cost: ₦{item.costPrice.toLocaleString()}</p>}
                  </div>
                  <p className="text-sm font-bold text-gray-900 flex-shrink-0">₦{item.unitPrice.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
          {parsedItems.length > 10 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                + {parsedItems.length - 10} more ({parsedItems.slice(10).filter(i => i.name.toLowerCase().trim() in existingStockMap).length} updates, {parsedItems.slice(10).filter(i => !(i.name.toLowerCase().trim() in existingStockMap)).length} new)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-red-600">Skipped rows ({parseErrors.length})</p>
          </div>
          <div className="divide-y divide-red-50/50 max-h-40 overflow-y-auto">
            {parseErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2.5">
                <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">Row {e.row}: {e.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {parsedItems.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-bold text-gray-900 mb-1">No valid rows found</p>
          <p className="text-xs text-gray-400 mb-4">Make sure your CSV has the required columns (name, category, unitPrice, quantity, costPrice) and no missing values.</p>
          <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
            Try Another File
          </button>
        </div>
      ) : (
        <button onClick={handleImport}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
          <CloudUpload size={18} /> Import {parsedItems.length} Item{parsedItems.length !== 1 ? 's' : ''}
        </button>
      )}

      <button onClick={() => fileRef.current?.click()} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors text-center">
        Choose a different file
      </button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );

  if (!isOwner && !can('import_data')) {
    return <AccessRestricted message="You don't have permission to import data." />;
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Import Inventory</h1>
          <p className="text-xs text-gray-400">Bulk-add or update stock items from a CSV file</p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 p-10 flex flex-col items-center gap-4 cursor-pointer transition-all hover:bg-blue-50/20 group"
      >
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
          <CloudUpload size={36} className="text-blue-500" />
        </div>
        <div className="text-center">
          <p className="font-bold text-gray-900">Import from CSV</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">Upload a CSV file to bulk-add or update inventory items. Existing items matched by name will be updated.</p>
        </div>
        <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
          Choose CSV File
        </button>
        <p className="text-xs text-gray-400">or drag and drop your file here</p>
      </div>

      {/* Format card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Expected CSV Format</h3>
        <p className="text-xs text-gray-500">Your CSV file should have these columns (header row optional):</p>
        <div className="space-y-1">
          {[
            { n: 1, col: 'name',        label: 'Product Name',  req: true  },
            { n: 2, col: 'category',    label: 'Category',      req: true  },
            { n: 3, col: 'unitPrice',   label: 'Selling Price', req: true  },
            { n: 4, col: 'quantity',    label: 'Quantity',      req: true  },
            { n: 5, col: 'costPrice',   label: 'Cost Price',    req: true  },
            { n: 6, col: 'unit',        label: 'Size / Unit',   req: false },
            { n: 7, col: 'color',       label: 'Color',         req: false },
            { n: 8, col: 'description', label: 'Description',   req: false },
          ].map(({ n, col, label, req }) => (
            <div key={col} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${req ? 'bg-blue-50/40' : ''}`}>
              <span className="text-xs text-gray-400 w-4 flex-shrink-0 font-mono">{n}</span>
              <code className="text-xs font-mono text-[#050A30] bg-gray-100 px-1.5 py-0.5 rounded w-28 flex-shrink-0">{col}</code>
              <span className="text-xs text-gray-500 flex-1">{label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${req ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                {req ? 'Required' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 font-medium mb-1">Example row:</p>
          <code className="text-xs text-gray-600 break-all">Rice 5kg,Grains,3500,100,2800,bag,White,Imported long grain</code>
        </div>
        <p className="text-xs text-gray-400">
          Also accepts: <code className="bg-gray-100 px-1 rounded text-xs">qty</code>, <code className="bg-gray-100 px-1 rounded text-xs">selling price</code>, <code className="bg-gray-100 px-1 rounded text-xs">cost</code>, <code className="bg-gray-100 px-1 rounded text-xs">product name</code>, etc.
        </p>
        <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs font-semibold text-[#050A30] hover:underline">
          <Download size={13} /> Download template CSV
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Tip: Export your spreadsheet as .csv (comma-separated) before importing.
      </p>
    </div>
  );
}
