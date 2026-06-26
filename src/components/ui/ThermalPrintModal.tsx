'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Printer, Bluetooth, Cable, RefreshCw, Loader2, CheckCircle2, AlertCircle, Wifi } from 'lucide-react';
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

type Stage =
  | 'menu'
  | 'bt-unavailable' | 'bt-reconnect' | 'bt-scanning'
  | 'usb-unavailable' | 'usb-reconnect' | 'usb-scanning'
  | 'connecting' | 'printing' | 'done' | 'error';

type PaperSize = '58mm' | '80mm';

const COLS: Record<PaperSize, number> = { '58mm': 32, '80mm': 48 };

const BT_STORAGE_KEY  = 'thermal_last_printer';
const USB_STORAGE_KEY = 'thermal_last_usb_printer';
const PAPER_SIZE_KEY  = 'thermal_paper_size';

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

function buildEscPos(data: ThermalReceiptData, size: PaperSize): Uint8Array {
  const cols = COLS[size];
  const sep = '-'.repeat(cols);
  const chunks: Uint8Array[] = [];

  const push = (...arrs: Uint8Array[]) => chunks.push(...arrs);
  const ESC = 0x1B;
  const GS  = 0x1D;
  const cmd = (...bytes: number[]) => new Uint8Array(bytes);
  const line = (s: string) => enc(s + '\n');

  const amt = (n: number) =>
    `N${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  push(cmd(ESC, 0x40));
  push(cmd(ESC, 0x61, 0x01));
  push(cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11));
  push(line(data.businessName));
  push(cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00));
  if (data.businessPhone)  push(line(data.businessPhone));
  if (data.businessAddress) push(line(data.businessAddress));
  push(line(''));
  push(cmd(ESC, 0x61, 0x00));
  push(line(sep));

  const typeLabel = data.receiptType === 'INVOICE' ? 'INVOICE' : 'RECEIPT';
  if (data.invoiceNo)      push(line(`${typeLabel} #: ${data.invoiceNo}`));
  if (data.date)           push(line(`DATE: ${data.date}`));
  if (data.customerName)   push(line(`CUST: ${data.customerName}`));
  if (data.paymentMethod)  push(line(`PAY:  ${data.paymentMethod}`));
  push(line(sep));

  for (const item of data.items) {
    const name = item.name.length > cols ? item.name.slice(0, cols - 1) + '~' : item.name;
    push(line(name));
    const left  = `  ${item.quantity} x ${amt(item.unitPrice)}`;
    const right = amt(item.total);
    const gap   = Math.max(1, cols - left.length - right.length);
    push(line(left + ' '.repeat(gap) + right));
  }

  push(line(sep));

  const amtW = Math.max(12, amt(data.grandTotal).length + 1);
  const lblW = cols - amtW;

  push(line(padRight('Subtotal', lblW) + padLeft(amt(data.subtotal), amtW)));
  if (data.discountAmount && data.discountAmount > 0)
    push(line(padRight('Discount', lblW) + padLeft('-' + amt(data.discountAmount), amtW)));
  if (data.vatAmount && data.vatAmount > 0)
    push(line(padRight('VAT', lblW) + padLeft(amt(data.vatAmount), amtW)));
  push(line(sep));

  push(cmd(ESC, 0x45, 0x01));
  push(line(padRight('TOTAL', lblW) + padLeft(amt(data.grandTotal), amtW)));
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

async function sendViaUSB(device: any, data: Uint8Array) {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  let interfaceNumber = 0;
  let endpointNumber  = 1;
  let claimed         = false;

  for (const iface of device.configurations[0].interfaces) {
    for (const alt of iface.alternates) {
      const ep = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
      if (!ep) continue;
      interfaceNumber = iface.interfaceNumber;
      endpointNumber  = ep.endpointNumber;
      claimed = true;
      break;
    }
    if (claimed) break;
  }

  await device.claimInterface(interfaceNumber);

  const CHUNK = 64;
  for (let i = 0; i < data.length; i += CHUNK) {
    await device.transferOut(endpointNumber, data.slice(i, i + CHUNK));
    await delay(10);
  }

  await device.close();
}

// ── Saved-printer helpers ───────────────────────────────────────────────────

function getBtPrinter(): { id: string; name: string } | null {
  try { const s = localStorage.getItem(BT_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveBtPrinter(id: string, name: string) {
  try { localStorage.setItem(BT_STORAGE_KEY, JSON.stringify({ id, name })); } catch {}
}

function getUsbPrinter(): { vendorId: number; productId: number; name: string } | null {
  try { const s = localStorage.getItem(USB_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveUsbPrinter(vendorId: number, productId: number, name: string) {
  try { localStorage.setItem(USB_STORAGE_KEY, JSON.stringify({ vendorId, productId, name })); } catch {}
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ThermalPrintModal({ visible, onClose, receiptData }: ThermalPrintModalProps) {
  const [stage, setStage]             = useState<Stage>('menu');
  const [paperSize, setPaperSize]     = useState<PaperSize>(() => {
    try { return (localStorage.getItem(PAPER_SIZE_KEY) as PaperSize) || '58mm'; } catch { return '58mm'; }
  });
  const [errorMsg, setErrorMsg]       = useState('');
  const [savedBt,  setSavedBt]        = useState<{ id: string; name: string } | null>(null);
  const [savedUsb, setSavedUsb]       = useState<{ vendorId: number; productId: number; name: string } | null>(null);
  const methodRef                     = useRef<'bt' | 'usb'>('bt');
  const deviceRef                     = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    setStage('menu');
    deviceRef.current = null;
    setSavedBt(getBtPrinter());
    setSavedUsb(getUsbPrinter());
  }, [visible]);

  // ── Bluetooth ──────────────────────────────────────────────────────────────

  const btPrint = useCallback(async (device: any) => {
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
      if (!printed) throw new Error('No compatible BLE service found on this printer.');
      saveBtPrinter(device.id, device.name || 'Bluetooth Printer');
      setStage('done');
    } catch (e: any) {
      setErrorMsg(e?.message || 'Bluetooth print failed');
      setStage('error');
    }
  }, [receiptData, paperSize]);

  const startBtScan = useCallback(async () => {
    methodRef.current = 'bt';
    setStage('bt-scanning');
    try {
      const bt     = (navigator as any).bluetooth;
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_PROFILES.map(p => p.service),
      });
      deviceRef.current = device;
      await btPrint(device);
    } catch (e: any) {
      if (e?.name === 'NotFoundError' || e?.message?.includes('cancelled') || e?.message?.includes('User cancelled')) {
        setStage('menu');
      } else {
        setErrorMsg(e?.message || 'Could not connect');
        setStage('error');
      }
    }
  }, [btPrint]);

  const tryBtReconnect = useCallback(async () => {
    if (!savedBt) { startBtScan(); return; }
    methodRef.current = 'bt';
    setStage('connecting');
    try {
      const bt  = (navigator as any).bluetooth;
      let device: any = null;
      if (bt.getDevices) {
        const list: any[] = await bt.getDevices();
        device = list.find((d: any) => d.id === savedBt.id) || null;
      }
      if (!device) { startBtScan(); return; }
      deviceRef.current = device;
      await btPrint(device);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Bluetooth reconnect failed');
      setStage('error');
    }
  }, [savedBt, startBtScan, btPrint]);

  const handleBluetoothPrint = useCallback(() => {
    const bt = (navigator as any).bluetooth;
    if (!bt) { setStage('bt-unavailable'); return; }
    const saved = getBtPrinter();
    setSavedBt(saved);
    setStage(saved ? 'bt-reconnect' : 'bt-scanning');
    if (!saved) startBtScan();
  }, [startBtScan]);

  // ── USB ────────────────────────────────────────────────────────────────────

  const usbPrint = useCallback(async (device: any) => {
    setStage('connecting');
    try {
      setStage('printing');
      const bytes = buildEscPos(receiptData, paperSize);
      await sendViaUSB(device, bytes);
      saveUsbPrinter(device.vendorId, device.productId, device.productName || 'USB Printer');
      setSavedUsb(getUsbPrinter());
      setStage('done');
    } catch (e: any) {
      try { await device.close(); } catch {}
      setErrorMsg(e?.message || 'USB print failed');
      setStage('error');
    }
  }, [receiptData, paperSize]);

  const startUsbScan = useCallback(async () => {
    methodRef.current = 'usb';
    setStage('usb-scanning');
    try {
      const usb    = (navigator as any).usb;
      const device = await usb.requestDevice({ filters: [] });
      deviceRef.current = device;
      await usbPrint(device);
    } catch (e: any) {
      if (e?.name === 'NotFoundError' || e?.name === 'SecurityError' || e?.message?.includes('No device')) {
        setStage('menu');
      } else {
        setErrorMsg(e?.message || 'Could not connect to USB printer');
        setStage('error');
      }
    }
  }, [usbPrint]);

  const tryUsbReconnect = useCallback(async () => {
    if (!savedUsb) { startUsbScan(); return; }
    methodRef.current = 'usb';
    setStage('connecting');
    try {
      const usb     = (navigator as any).usb;
      const devices = await usb.getDevices();
      const device  = devices.find((d: any) =>
        d.vendorId === savedUsb.vendorId && d.productId === savedUsb.productId
      );
      if (!device) { startUsbScan(); return; }
      deviceRef.current = device;
      await usbPrint(device);
    } catch (e: any) {
      setErrorMsg(e?.message || 'USB reconnect failed');
      setStage('error');
    }
  }, [savedUsb, startUsbScan, usbPrint]);

  const handleUSBPrint = useCallback(() => {
    const usb = (navigator as any).usb;
    if (!usb) { setStage('usb-unavailable'); return; }
    const saved = getUsbPrinter();
    setSavedUsb(saved);
    setStage(saved ? 'usb-reconnect' : 'usb-scanning');
    if (!saved) startUsbScan();
  }, [startUsbScan]);

  // ── Browser fallback ───────────────────────────────────────────────────────

  const handleFallback = () => {
    onClose();
    openThermalPrintWindow(receiptData, paperSize === '58mm' ? 58 : 80);
  };

  if (!visible) return null;

  const showPaperPicker = ['menu', 'bt-reconnect', 'bt-unavailable', 'usb-reconnect', 'usb-unavailable'].includes(stage);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <Printer size={16} className="text-orange-500" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Thermal Print</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Paper size */}
        {showPaperPicker && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">Paper size</p>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as PaperSize[]).map(sz => (
                <button
                  key={sz}
                  onClick={() => { setPaperSize(sz); try { localStorage.setItem(PAPER_SIZE_KEY, sz); } catch {} }}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    paperSize === sz
                      ? 'bg-[#050A30] text-white border-[#050A30]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MENU ─────────────────────────────────────────────────────────── */}
        {stage === 'menu' && (
          <div className="space-y-2.5">
            <button
              onClick={handleBluetoothPrint}
              className="w-full py-3 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Bluetooth size={15} />
              Print via Bluetooth
            </button>
            <button
              onClick={handleUSBPrint}
              className="w-full py-3 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Cable size={15} />
              Print via USB
            </button>
            <button
              onClick={handleFallback}
              className="w-full py-3 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Printer size={15} />
              Print with Browser (Network)
            </button>
            <p className="text-center text-xs text-gray-400 pt-1">
              Bluetooth &amp; USB require Chrome or Edge
            </p>
          </div>
        )}

        {/* ── BLUETOOTH UNAVAILABLE ─────────────────────────────────────────── */}
        {stage === 'bt-unavailable' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Bluetooth size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Bluetooth Not Available</p>
              <p className="text-xs text-gray-500 mt-1">
                Web Bluetooth requires Chrome or Edge. Safari and Firefox do not support it.
              </p>
            </div>
            <button onClick={() => setStage('menu')} className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
              Back
            </button>
          </div>
        )}

        {/* ── BLUETOOTH RECONNECT ───────────────────────────────────────────── */}
        {stage === 'bt-reconnect' && savedBt && (
          <div className="space-y-3">
            <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Bluetooth size={16} className="text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{savedBt.name}</p>
                <p className="text-xs text-gray-500">Last used Bluetooth printer</p>
              </div>
            </div>
            <button
              onClick={tryBtReconnect}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Wifi size={14} />
              Connect &amp; Print (Bluetooth)
            </button>
            <button
              onClick={() => { localStorage.removeItem(BT_STORAGE_KEY); setSavedBt(null); startBtScan(); }}
              className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
            >
              Scan for a different Bluetooth printer
            </button>
          </div>
        )}

        {/* ── BLUETOOTH SCANNING ────────────────────────────────────────────── */}
        {stage === 'bt-scanning' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Bluetooth size={26} className="text-blue-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Scanning for Bluetooth Printers…</p>
            <p className="text-xs text-gray-500 text-center">Select your printer from the browser picker.</p>
          </div>
        )}

        {/* ── USB UNAVAILABLE ───────────────────────────────────────────────── */}
        {stage === 'usb-unavailable' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Cable size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">USB Not Available</p>
              <p className="text-xs text-gray-500 mt-1">
                Web USB requires Chrome or Edge. Safari and Firefox do not support it.
              </p>
            </div>
            <button onClick={() => setStage('menu')} className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
              Back
            </button>
          </div>
        )}

        {/* ── USB RECONNECT ─────────────────────────────────────────────────── */}
        {stage === 'usb-reconnect' && savedUsb && (
          <div className="space-y-3">
            <div className="bg-orange-50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Cable size={16} className="text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{savedUsb.name}</p>
                <p className="text-xs text-gray-500">Last used USB printer</p>
              </div>
            </div>
            <button
              onClick={tryUsbReconnect}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Cable size={14} />
              Connect &amp; Print (USB)
            </button>
            <button
              onClick={() => { localStorage.removeItem(USB_STORAGE_KEY); setSavedUsb(null); startUsbScan(); }}
              className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
            >
              Scan for a different USB printer
            </button>
          </div>
        )}

        {/* ── USB SCANNING ──────────────────────────────────────────────────── */}
        {stage === 'usb-scanning' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Cable size={26} className="text-blue-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Scanning for USB Printers…</p>
            <p className="text-xs text-gray-500 text-center">Select your printer from the browser picker.</p>
          </div>
        )}

        {/* ── CONNECTING ────────────────────────────────────────────────────── */}
        {stage === 'connecting' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#050A30] animate-spin" />
            <p className="text-sm font-semibold text-gray-900">Connecting…</p>
            <p className="text-xs text-gray-500">Establishing connection to printer</p>
          </div>
        )}

        {/* ── PRINTING ──────────────────────────────────────────────────────── */}
        {stage === 'printing' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <Printer size={26} className="text-orange-500 animate-pulse" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Printing…</p>
            <p className="text-xs text-gray-500">Sending receipt to printer</p>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────────────── */}
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

        {/* ── ERROR ─────────────────────────────────────────────────────────── */}
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
                onClick={() => methodRef.current === 'usb' ? startUsbScan() : startBtScan()}
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
              <button
                onClick={() => setStage('menu')}
                className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
              >
                Back to options
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
