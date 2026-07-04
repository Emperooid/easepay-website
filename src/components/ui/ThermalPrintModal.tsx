'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Printer, Bluetooth, Cable, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
  | 'bt-unavailable' | 'bt-scanning' | 'bt-classic'
  | 'usb-unavailable' | 'usb-scanning'
  | 'connecting' | 'printing' | 'done' | 'error';

type Method = 'bt' | 'usb';
type PaperSize = '58mm' | '80mm';

const COLS: Record<PaperSize, number> = { '58mm': 32, '80mm': 48 };
const BT_STORAGE_KEY  = 'thermal_last_printer';
const USB_STORAGE_KEY = 'thermal_last_usb_printer';
const PAPER_SIZE_KEY  = 'thermal_paper_size';

const BLE_PROFILES = [
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff02-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', char: '0000ff01-0000-1000-8000-00805f9b34fb' },
  { service: '0000ffe0-0000-1000-8000-00805f9b34fb', char: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af0-0000-1000-8000-00805f9b34fb' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', char: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', char: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', char: '49535343-1e4d-4bd9-ba61-23c647249616' },
];
const BLE_SERVICES = [...new Set(BLE_PROFILES.map(p => p.service))];

// ── ESC/POS builder ───────────────────────────────────────────────────────────

function buildEscPos(data: ThermalReceiptData, size: PaperSize): Uint8Array {
  const cols = COLS[size];
  const sep  = '-'.repeat(cols);
  const chunks: Uint8Array[] = [];
  const ESC = 0x1B, GS = 0x1D;
  const cmd  = (...b: number[]) => new Uint8Array(b);
  const line = (s: string)      => new TextEncoder().encode(s + '\n');
  const push = (...arrs: Uint8Array[]) => chunks.push(...arrs);
  const N    = (n: number) => `N${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const pr   = (s: string, n: number) => s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
  const pl   = (s: string, n: number) => s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;

  push(cmd(ESC, 0x40));
  push(cmd(ESC, 0x61, 0x01));
  push(cmd(ESC, 0x45, 0x01), cmd(GS, 0x21, 0x11));
  push(line(data.businessName));
  push(cmd(GS, 0x21, 0x00), cmd(ESC, 0x45, 0x00));
  if (data.businessPhone)   push(line(data.businessPhone));
  if (data.businessAddress) push(line(data.businessAddress));
  push(line(''));
  push(cmd(ESC, 0x61, 0x00));
  push(line(sep));

  const typeLabel = data.receiptType === 'INVOICE' ? 'INVOICE' : 'RECEIPT';
  if (data.invoiceNo)     push(line(`${typeLabel} #: ${data.invoiceNo}`));
  if (data.date)          push(line(`DATE: ${data.date}`));
  if (data.customerName)  push(line(`CUST: ${data.customerName}`));
  if (data.paymentMethod) push(line(`PAY:  ${data.paymentMethod}`));
  push(line(sep));

  for (const item of data.items) {
    const name = item.name.length > cols ? item.name.slice(0, cols - 1) + '~' : item.name;
    push(line(name));
    const left = `  ${item.quantity} x ${N(item.unitPrice)}`;
    const right = N(item.total);
    push(line(left + ' '.repeat(Math.max(1, cols - left.length - right.length)) + right));
  }
  push(line(sep));

  const amtW = Math.max(12, N(data.grandTotal).length + 1);
  const lblW = cols - amtW;
  push(line(pr('Subtotal', lblW) + pl(N(data.subtotal), amtW)));
  if (data.discountAmount && data.discountAmount > 0)
    push(line(pr('Discount', lblW) + pl('-' + N(data.discountAmount), amtW)));
  if (data.vatAmount && data.vatAmount > 0)
    push(line(pr('VAT', lblW) + pl(N(data.vatAmount), amtW)));
  push(line(sep));
  push(cmd(ESC, 0x45, 0x01));
  push(line(pr('TOTAL', lblW) + pl(N(data.grandTotal), amtW)));
  push(cmd(ESC, 0x45, 0x00));
  push(line(sep));
  if (data.notes) { push(line('Notes: ' + data.notes)); push(line(sep)); }
  push(cmd(ESC, 0x61, 0x01));
  push(line('Thank you for your business!'));
  push(line(''), line(''), line(''));
  push(cmd(GS, 0x56, 0x42, 0x00));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

// ── Printer I/O ───────────────────────────────────────────────────────────────

async function sendToCharacteristic(char: any, data: Uint8Array) {
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    await char.writeValueWithoutResponse(data.slice(i, i + CHUNK));
    await new Promise(r => setTimeout(r, 50));
  }
}

async function sendViaBLE(server: any, bytes: Uint8Array): Promise<boolean> {
  for (const p of BLE_PROFILES) {
    try {
      const svc  = await server.getPrimaryService(p.service);
      const char = await svc.getCharacteristic(p.char);
      await sendToCharacteristic(char, bytes);
      return true;
    } catch {}
  }
  // Dynamic fallback
  try {
    const svcs = await server.getPrimaryServices();
    for (const svc of svcs) {
      try {
        const chars = await svc.getCharacteristics();
        for (const char of chars) {
          if (char.properties.writeWithoutResponse || char.properties.write) {
            await sendToCharacteristic(char, bytes);
            return true;
          }
        }
      } catch {}
    }
  } catch {}
  return false;
}

async function sendViaUSB(device: any, data: Uint8Array) {
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  let ifaceNum = 0, epNum = 1, found = false;
  for (const iface of device.configurations[0].interfaces) {
    for (const alt of iface.alternates) {
      const ep = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
      if (!ep) continue;
      ifaceNum = iface.interfaceNumber; epNum = ep.endpointNumber; found = true; break;
    }
    if (found) break;
  }
  await device.claimInterface(ifaceNum);
  const CHUNK = 64;
  for (let i = 0; i < data.length; i += CHUNK) {
    await device.transferOut(epNum, data.slice(i, i + CHUNK));
    await new Promise(r => setTimeout(r, 10));
  }
  await device.close();
}

// ── Storage helpers ───────────────────────────────────────────────────────────

type SavedBt  = { id: string; name: string };
type SavedUsb = { vendorId: number; productId: number; name: string };

const getBtPrinter  = (): SavedBt  | null => { try { const s = localStorage.getItem(BT_STORAGE_KEY);  return s ? JSON.parse(s) : null; } catch { return null; } };
const saveBtPrinter = (id: string, name: string)                        => { try { localStorage.setItem(BT_STORAGE_KEY,  JSON.stringify({ id, name })); } catch {} };
const getUsbPrinter  = (): SavedUsb | null => { try { const s = localStorage.getItem(USB_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveUsbPrinter = (vendorId: number, productId: number, name: string) => { try { localStorage.setItem(USB_STORAGE_KEY, JSON.stringify({ vendorId, productId, name })); } catch {} };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ThermalPrintModal({ visible, onClose, receiptData }: ThermalPrintModalProps) {
  const [stage, setStage]     = useState<Stage>('menu');
  const [paperSize, setPaperSize] = useState<PaperSize>(() => {
    try { return (localStorage.getItem(PAPER_SIZE_KEY) as PaperSize) || '58mm'; } catch { return '58mm'; }
  });
  const [errorMsg, setErrorMsg]   = useState('');
  const [printerName, setPrinterName] = useState('');
  const methodRef  = useRef<Method>('bt');
  const deviceRef  = useRef<any>(null);
  const savedBtRef = useRef<SavedBt  | null>(null);
  const savedUsbRef = useRef<SavedUsb | null>(null);

  // ── BT print core ────────────────────────────────────────────────────────────

  const btPrint = useCallback(async (device: any) => {
    setStage('connecting');
    setPrinterName(device.name || 'Bluetooth Printer');
    try {
      const server = await device.gatt!.connect();
      setStage('printing');
      const bytes   = buildEscPos(receiptData, paperSize);
      const printed = await sendViaBLE(server, bytes);
      if (!printed) { setStage('bt-classic'); return; }
      saveBtPrinter(device.id, device.name || 'Bluetooth Printer');
      setStage('done');
    } catch (e: any) {
      const msg = e?.message || '';
      setErrorMsg(
        msg.includes('GATT')
          ? 'Could not reach the printer. Make sure it is on and not paired to another device.'
          : msg.includes('security') || msg.includes('pairing')
          ? 'Pair the printer in your device Bluetooth settings first, then try again.'
          : msg || 'Bluetooth print failed.'
      );
      setStage('error');
    }
  }, [receiptData, paperSize]);

  // ── BT scan (browser picker) ─────────────────────────────────────────────────

  const startBtScan = useCallback(async () => {
    methodRef.current = 'bt';
    setStage('bt-scanning');
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_SERVICES,
      });
      deviceRef.current = device;
      await btPrint(device);
    } catch (e: any) {
      const { name = '', message = '' } = e ?? {};
      if (name === 'NotFoundError' || message.includes('cancel') || message.includes('chosen')) {
        setStage('menu');
      } else if (name === 'NotSupportedError' || message.includes('not supported') || message.includes('adapter')) {
        setStage('bt-unavailable');
      } else {
        setErrorMsg(message || 'Could not connect to Bluetooth printer.');
        setStage('error');
      }
    }
  }, [btPrint]);

  // ── BT reconnect to last printer ─────────────────────────────────────────────
  // fallbackToScan=true when called from a user tap (requestDevice is allowed).
  // fallbackToScan=false when called from useEffect (requestDevice would throw SecurityError).

  const tryBtReconnect = useCallback(async (saved: SavedBt, fallbackToScan = true) => {
    methodRef.current = 'bt';
    setStage('connecting');
    setPrinterName(saved.name);
    try {
      const bt  = (navigator as any).bluetooth;
      let device: any = null;
      if (bt?.getDevices) {
        const list: any[] = await bt.getDevices();
        device = list.find((d: any) => d.id === saved.id) ?? null;
      }
      if (!device) {
        if (fallbackToScan) { await startBtScan(); } else { setStage('menu'); }
        return;
      }
      deviceRef.current = device;
      await btPrint(device);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Bluetooth reconnect failed.');
      setStage('error');
    }
  }, [btPrint, startBtScan]);

  // ── USB print core ───────────────────────────────────────────────────────────

  const usbPrint = useCallback(async (device: any) => {
    setStage('connecting');
    setPrinterName(device.productName || 'USB Printer');
    try {
      setStage('printing');
      const bytes = buildEscPos(receiptData, paperSize);
      await sendViaUSB(device, bytes);
      saveUsbPrinter(device.vendorId, device.productId, device.productName || 'USB Printer');
      setStage('done');
    } catch (e: any) {
      try { await device.close(); } catch {}
      const msg = e?.message || '';
      const isDriver = msg.toLowerCase().includes('claim') || msg.toLowerCase().includes('access') || e?.name === 'SecurityError' || e?.name === 'NetworkError';
      setErrorMsg(
        isDriver
          ? 'Windows is controlling this USB printer via its own driver. Use "Print with Browser" instead and pick your thermal printer in Chrome\'s print dialog.'
          : msg || 'USB print failed.'
      );
      setStage('error');
    }
  }, [receiptData, paperSize]);

  // ── USB scan (browser picker) ─────────────────────────────────────────────────

  const startUsbScan = useCallback(async () => {
    methodRef.current = 'usb';
    setStage('usb-scanning');
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      deviceRef.current = device;
      await usbPrint(device);
    } catch (e: any) {
      const { name = '', message = '' } = e ?? {};
      if (name === 'NotFoundError' || message.includes('No device') || message.includes('cancel')) {
        setStage('menu');
      } else if (name === 'NotSupportedError') {
        setStage('usb-unavailable');
      } else {
        setErrorMsg(message || 'Could not connect to USB printer.');
        setStage('error');
      }
    }
  }, [usbPrint]);

  // ── USB reconnect ────────────────────────────────────────────────────────────

  const tryUsbReconnect = useCallback(async (saved: SavedUsb, fallbackToScan = true) => {
    methodRef.current = 'usb';
    setStage('connecting');
    setPrinterName(saved.name);
    try {
      const devices: any[] = await (navigator as any).usb.getDevices();
      const device = devices.find(d => d.vendorId === saved.vendorId && d.productId === saved.productId);
      if (!device) {
        if (fallbackToScan) { await startUsbScan(); } else { setStage('menu'); }
        return;
      }
      deviceRef.current = device;
      await usbPrint(device);
    } catch (e: any) {
      setErrorMsg(e?.message || 'USB reconnect failed.');
      setStage('error');
    }
  }, [usbPrint, startUsbScan]);

  // ── Open: auto-connect to last printer (mobile-like) ─────────────────────────

  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    setPrinterName('');
    deviceRef.current = null;

    const savedBt  = getBtPrinter();
    const savedUsb = getUsbPrinter();
    savedBtRef.current  = savedBt;
    savedUsbRef.current = savedUsb;

    const bt  = (navigator as any).bluetooth;
    const usb = (navigator as any).usb;

    // Silently reconnect via getDevices() (no user gesture needed).
    // Pass false so we never fall through to requestDevice() from here —
    // that requires a user gesture and throws SecurityError in useEffect.
    if (savedBt && bt) {
      methodRef.current = 'bt';
      tryBtReconnect(savedBt, false);
      return;
    }
    if (savedUsb && usb) {
      methodRef.current = 'usb';
      tryUsbReconnect(savedUsb, false);
      return;
    }

    setStage('menu');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Browser (direct) print ───────────────────────────────────────────────────
  // Open window FIRST (preserves user-gesture context), then close modal.

  const handleBrowserPrint = () => {
    openThermalPrintWindow(receiptData, paperSize === '58mm' ? 58 : 80);
    onClose();
  };

  // ── Handler shortcuts ─────────────────────────────────────────────────────────

  const handleBtPress = () => {
    const bt = (navigator as any).bluetooth;
    if (!bt) { setStage('bt-unavailable'); return; }
    const saved = getBtPrinter();
    if (saved) { tryBtReconnect(saved); } else { startBtScan(); }
  };

  const handleUsbPress = () => {
    const usb = (navigator as any).usb;
    if (!usb) { setStage('usb-unavailable'); return; }
    const saved = getUsbPrinter();
    if (saved) { tryUsbReconnect(saved); } else { startUsbScan(); }
  };

  const handleRetry = () => {
    if (methodRef.current === 'usb') {
      const saved = savedUsbRef.current;
      if (saved) tryUsbReconnect(saved); else startUsbScan();
    } else {
      const saved = savedBtRef.current;
      if (saved) tryBtReconnect(saved); else startBtScan();
    }
  };

  const setSz = (sz: PaperSize) => {
    setPaperSize(sz);
    try { localStorage.setItem(PAPER_SIZE_KEY, sz); } catch {}
  };

  if (!visible) return null;

  const showPaper = ['menu', 'bt-unavailable', 'usb-unavailable', 'bt-classic'].includes(stage);

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

        {/* Paper size — only on idle screens */}
        {showPaper && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-1.5">Paper size</p>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as PaperSize[]).map(sz => (
                <button
                  key={sz}
                  onClick={() => setSz(sz)}
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

        {/* ── MENU ─────────────────────────────────────────────────────────────── */}
        {stage === 'menu' && (
          <div className="space-y-2.5">
            <button
              onClick={handleBtPress}
              className="w-full py-3.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <Bluetooth size={15} />
              {getBtPrinter() ? `Reconnect: ${getBtPrinter()!.name}` : 'Print via Bluetooth'}
            </button>
            <button
              onClick={handleUsbPress}
              className="w-full py-3 border-2 border-[#050A30] text-[#050A30] text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Cable size={15} />
              {getUsbPrinter() ? `Reconnect: ${getUsbPrinter()!.name}` : 'Print via USB'}
            </button>
            <button
              onClick={handleBrowserPrint}
              className="w-full py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Printer size={15} />
              Print with Browser
            </button>
            {(getBtPrinter() || getUsbPrinter()) && (
              <button
                onClick={() => {
                  localStorage.removeItem(BT_STORAGE_KEY);
                  localStorage.removeItem(USB_STORAGE_KEY);
                  savedBtRef.current = null;
                  savedUsbRef.current = null;
                  setStage('menu');
                }}
                className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors"
              >
                Forget saved printers
              </button>
            )}
            <p className="text-center text-xs text-gray-400 pt-0.5">
              Bluetooth &amp; USB require Chrome or Edge
            </p>
          </div>
        )}

        {/* ── BLUETOOTH UNAVAILABLE ─────────────────────────────────────────────── */}
        {stage === 'bt-unavailable' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Bluetooth size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Bluetooth Not Available</p>
              <p className="text-xs text-gray-500 mt-1">Web Bluetooth requires Chrome or Edge on Android/desktop. Safari and Firefox are not supported.</p>
            </div>
            <button onClick={() => setStage('menu')} className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">Back</button>
          </div>
        )}

        {/* ── BLUETOOTH SCANNING ───────────────────────────────────────────────── */}
        {stage === 'bt-scanning' && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Bluetooth size={26} className="text-blue-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Select your printer</p>
            <p className="text-xs text-gray-500">Choose from the browser Bluetooth picker that just appeared.</p>
          </div>
        )}

        {/* ── CLASSIC BLUETOOTH ─────────────────────────────────────────────────── */}
        {stage === 'bt-classic' && (
          <div className="flex flex-col gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">Classic Bluetooth Printer</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                This printer uses Classic Bluetooth (SPP), which browsers can't access directly.
                Use <strong>Print with Browser</strong> — select your paired thermal printer in Chrome's print dialog.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                On mobile? Use the <strong>EasePay mobile app</strong> for seamless Classic Bluetooth printing.
              </p>
            </div>
            <button onClick={handleBrowserPrint} className="w-full py-3 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2">
              <Printer size={15} />
              Print with Browser
            </button>
            <button onClick={() => setStage('menu')} className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors">
              Back to options
            </button>
          </div>
        )}

        {/* ── USB UNAVAILABLE ───────────────────────────────────────────────────── */}
        {stage === 'usb-unavailable' && (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Cable size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">USB Not Available</p>
              <p className="text-xs text-gray-500 mt-1">Web USB requires Chrome or Edge. Safari and Firefox are not supported.</p>
            </div>
            <button onClick={() => setStage('menu')} className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">Back</button>
          </div>
        )}

        {/* ── USB SCANNING ──────────────────────────────────────────────────────── */}
        {stage === 'usb-scanning' && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Cable size={26} className="text-blue-500" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 animate-ping" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Select your USB printer</p>
            <p className="text-xs text-gray-500">Choose from the browser USB picker that just appeared.</p>
          </div>
        )}

        {/* ── CONNECTING ────────────────────────────────────────────────────────── */}
        {stage === 'connecting' && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <Loader2 size={36} className="text-[#050A30] animate-spin" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Connecting…</p>
              {printerName && <p className="text-xs text-gray-500 mt-0.5">{printerName}</p>}
            </div>
          </div>
        )}

        {/* ── PRINTING ──────────────────────────────────────────────────────────── */}
        {stage === 'printing' && (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
              <Printer size={26} className="text-orange-500 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Printing…</p>
              {printerName && <p className="text-xs text-gray-500 mt-0.5">{printerName}</p>}
            </div>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────────────────── */}
        {stage === 'done' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={34} className="text-green-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Printed!</p>
              {printerName && <p className="text-xs text-gray-500 mt-0.5">{printerName}</p>}
            </div>
            <button onClick={onClose} className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
              Done
            </button>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────────────── */}
        {stage === 'error' && (
          <div className="flex flex-col gap-3">
            <div className="py-4 flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">Print Failed</p>
              {errorMsg && <p className="text-xs text-gray-500 leading-relaxed max-w-xs">{errorMsg}</p>}
            </div>
            <button
              onClick={handleRetry}
              className="w-full py-2.5 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={13} />
              Try Again
            </button>
            <button
              onClick={handleBrowserPrint}
              className="w-full py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Printer size={14} />
              Print with Browser
            </button>
            <button onClick={() => setStage('menu')} className="w-full py-1.5 text-gray-400 text-xs font-medium hover:text-gray-600 transition-colors">
              Back to options
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
