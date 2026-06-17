'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Printer, Bluetooth, RefreshCw, Loader2, CheckCircle2, AlertCircle, Wifi } from 'lucide-react';
import { openThermalPrintWindow } from '@/lib/receiptPrint';

export interface ThermalReceiptData {
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  paymentMethod?: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  vatAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  receiptType?: 'RECEIPT' | 'INVOICE' | 'EXPENSE';
  notes?: string;
}

export interface ThermalPrintModalProps {
  visible: boolean;
  onClose: () => void;
  receiptData: ThermalReceiptData;
}

type Stage = 'checking' | 'unavailable' | 'reconnect' | 'scanning' | 'connecting' | 'printing' | 'done' | 'error';
type PaperSize = '58mm' | '80mm';

const COLS: Record<PaperSize, number> = { '58mm': 32, '80mm': 48 };

const STORAGE_KEY = 'thermal_last_printer';

const BLE_PROFILES = [
  { service: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af0-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
];

function enc(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function padRight(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}

function centerText(s: string, n: number): string {
  const left = Math.floor((n - s.length) / 2);
  return left > 0 ? ' '.repeat(left) + s : s;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);
}

function buildEscPos(data: ThermalReceiptData, size: PaperSize): Uint8Array {
  const cols = COLS[size];
  const sep = '-'.repeat(cols);
  const chunks: Uint8Array[] = [];

  const push = (...arrs: Uint8Array[]) => chunks.push(...arrs);
  const ESC = 0x1B;
  const GS  = 0x1D;
  const cmd = (...bytes: number[]) => new Uint8Array(bytes);
  const line = (s: string) => enc(s + '\n');

  // Init
  push(cmd(ESC, 0x40));
  // Center
  push(cmd(ESC, 0x61, 0x01));
  // Bold + double size
  push(cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11));
  push(line(data.businessName));
  // Normal size, bold off
  push(cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00));
  if (data.businessPhone) push(line(data.businessPhone));
  if (data.businessAddress) push(line(data.businessAddress));
  push(line(''));
  push(cmd(ESC, 0x61, 0x00)); // left align
  push(line(sep));

  const typeLabel = data.receiptType === 'INVOICE' ? 'INVOICE' : 'RECEIPT';
  if (data.invoiceNo) push(line(`${typeLabel} #: ${data.invoiceNo}`));
  if (data.date)      push(line(`Date: ${data.date}`));
  if (data.customerName)    push(line(`Customer: ${data.customerName}`));
  if (data.paymentMethod)   push(line(`Payment: ${data.paymentMethod}`));
  push(line(sep));

  // Header row
  const nameW = cols - 18;
  push(line(padRight('ITEM', nameW) + padLeft('QTY', 4) + padLeft('PRICE', 7) + padLeft('AMT', 7)));
  push(line(sep));

  for (const item of data.items) {
    const nameLine = padRight(item.name.slice(0, nameW), nameW)
      + padLeft(String(item.quantity), 4)
      + padLeft(formatCurrency(item.unitPrice).replace('₦', ''), 7)
      + padLeft(formatCurrency(item.total).replace('₦', ''), 7);
    push(line(nameLine));
  }

  push(line(sep));
  push(line(padRight('Subtotal', cols - 12) + padLeft(formatCurrency(data.subtotal), 12)));
  if (data.discountAmount && data.discountAmount > 0)
    push(line(padRight('Discount', cols - 12) + padLeft('-' + formatCurrency(data.discountAmount), 12)));
  if (data.vatAmount && data.vatAmount > 0)
    push(line(padRight('VAT', cols - 12) + padLeft(formatCurrency(data.vatAmount), 12)));
  push(line(sep));

  // Bold grand total
  push(cmd(ESC, 0x45, 0x01));
  push(line(padRight('TOTAL', cols - 12) + padLeft(formatCurrency(data.grandTotal), 12)));
  push(cmd(ESC, 0x45, 0x00));
  push(line(sep));

  if (data.notes) {
    push(line('Notes: ' + data.notes));
    push(line(sep));
  }

  push(cmd(ESC, 0x61, 0x01));
  push(line('Thank you for your business!'));
  push(line(''));
  push(line(''));
  push(line(''));
  // Cut
  push(cmd(GS, 0x56, 0x42, 0x00));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function sendToCharacteristic(char: any, data: Uint8Array) {
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    await char.writeValueWithoutResponse(data.slice(i, i + CHUNK));
    await delay(50);
  }
}

export default function ThermalPrintModal({ visible, onClose, receiptData }: ThermalPrintModalProps) {
  const [stage, setStage] = useState<Stage>('checking');
  const [paperSize, setPaperSize] = useState<PaperSize>('80mm');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedPrinter, setSavedPrinter] = useState<{ id: string; name: string } | null>(null);
  const deviceRef = useRef<any>(null);

  const getSavedPrinter = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) as { id: string; name: string } : null;
    } catch { return null; }
  };

  const savePrinter = (id: string, name: string) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name })); } catch {}
  };

  const clearSavedPrinter = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setSavedPrinter(null);
  };

  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    deviceRef.current = null;

    const bt = (navigator as any).bluetooth;
    if (!bt) { setStage('unavailable'); return; }

    const saved = getSavedPrinter();
    setSavedPrinter(saved);
    setStage(saved ? 'reconnect' : 'scanning');

    if (!saved) {
      // Auto-open scan when no saved printer
      startScan();
    }
  }, [visible]);

  const printData = useCallback(async (device: any) => {
    setStage('connecting');
    try {
      const server = await device.gatt!.connect();
      setStage('printing');
      const bytes = buildEscPos(receiptData, paperSize);
      let printed = false;
      for (const profile of BLE_PROFILES) {
        try {
          const svc  = await server.getPrimaryService(profile.service);
          const char = await svc.getCharacteristic(profile.char);
          await sendToCharacteristic(char, bytes);
          printed = true;
          break;
        } catch {}
      }
      if (!printed) throw new Error('No compatible printer service found. Check if your printer is a BLE printer.');
      savePrinter(device.id, device.name || 'Thermal Printer');
      setStage('done');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Print failed');
      setStage('error');
    }
  }, [receiptData, paperSize]);

  const startScan = useCallback(async () => {
    setStage('scanning');
    try {
      const bt = (navigator as any).bluetooth;
      const device: any = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PROFILES.map(p => p.service),
      });
      deviceRef.current = device;
      await printData(device);
    } catch (e: any) {
      if (e?.name === 'NotFoundError' || e?.message?.includes('cancelled') || e?.message?.includes('User cancelled')) {
        // User cancelled the picker
        const saved = getSavedPrinter();
        setStage(saved ? 'reconnect' : 'unavailable');
      } else {
        setErrorMsg(e?.message || 'Could not connect to printer');
        setStage('error');
      }
    }
  }, [printData]);

  const tryReconnect = useCallback(async () => {
    if (!savedPrinter) { setStage('scanning'); startScan(); return; }
    setStage('connecting');
    try {
      const bt = (navigator as any).bluetooth;
      let device: any = null;
      if (bt.getDevices) {
        const devices: any[] = await bt.getDevices();
        device = devices.find((d: any) => d.id === savedPrinter.id) || null;
      }
      if (!device) {
        // Can't auto-reconnect — open picker
        setStage('scanning');
        startScan();
        return;
      }
      deviceRef.current = device;
      await printData(device);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Reconnect failed');
      setStage('error');
    }
  }, [savedPrinter, startScan, printData]);

  const handleFallback = () => {
    onClose();
    openThermalPrintWindow(receiptData, paperSize === '58mm' ? 58 : 80);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <Bluetooth size={16} className="text-orange-500" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Thermal Print</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Paper size picker */}
        {(stage === 'reconnect' || stage === 'scanning' || stage === 'error') && (
          <div className="flex gap-2 mb-4">
            {(['58mm', '80mm'] as PaperSize[]).map(sz => (
              <button
                key={sz}
                onClick={() => setPaperSize(sz)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  paperSize === sz
                    ? 'bg-[#050A30] text-white border-[#050A30]'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        )}

        {/* Stage content */}
        {stage === 'checking' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#050A30] animate-spin" />
            <p className="text-sm text-gray-500">Checking Bluetooth…</p>
          </div>
        )}

        {stage === 'unavailable' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Bluetooth size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Bluetooth Not Supported</p>
              <p className="text-xs text-gray-500 mt-1">
                Your browser doesn&apos;t support Web Bluetooth. Use Chrome or Edge on desktop, or use the HTML print option below.
              </p>
            </div>
            <button
              onClick={handleFallback}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Printer size={14} />
              Print with Browser (HTML)
            </button>
          </div>
        )}

        {stage === 'reconnect' && savedPrinter && (
          <div className="space-y-3">
            <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Printer size={16} className="text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{savedPrinter.name}</p>
                <p className="text-xs text-gray-500">Last used printer</p>
              </div>
            </div>
            <button
              onClick={tryReconnect}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Wifi size={14} />
              Connect & Print
            </button>
            <button
              onClick={() => { clearSavedPrinter(); startScan(); }}
              className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              Scan for Different Printer
            </button>
            <button
              onClick={handleFallback}
              className="w-full py-2 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
            >
              Use browser print instead
            </button>
          </div>
        )}

        {stage === 'scanning' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Bluetooth size={26} className="text-blue-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Scanning for Printers…</p>
            <p className="text-xs text-gray-500 text-center">
              Select your printer from the browser&apos;s Bluetooth picker.
            </p>
            <button onClick={handleFallback} className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1">
              Cancel — use browser print
            </button>
          </div>
        )}

        {stage === 'connecting' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#050A30] animate-spin" />
            <p className="text-sm font-semibold text-gray-900">Connecting…</p>
            <p className="text-xs text-gray-500">Establishing connection to printer</p>
          </div>
        )}

        {stage === 'printing' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <Printer size={26} className="text-orange-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Printing…</p>
            <p className="text-xs text-gray-500">Sending receipt to printer</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={30} className="text-green-500" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Print Successful!</p>
            <p className="text-xs text-gray-500">Receipt sent to printer</p>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {stage === 'error' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Print Failed</p>
              {errorMsg && <p className="text-xs text-gray-500 mt-1">{errorMsg}</p>}
            </div>
            <div className="w-full space-y-2">
              <button
                onClick={() => startScan()}
                className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={13} />
                Try Again
              </button>
              <button
                onClick={handleFallback}
                className="w-full py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={14} />
                Print with Browser
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
