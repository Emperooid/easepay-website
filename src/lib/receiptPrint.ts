// Web receipt + invoice printing — mirrors mobile's pdfTemplate.ts + ThermalPrintModal logic.
// openReceiptPrintWindow  → 80mm monospace receipt (unchanged, do not break)
// openThermalPrintWindow  → 58mm / 80mm thermal HTML (port of mobile generateThermalReceiptHtml)
// openInvoicePrintWindow  → A4 professional invoice (port of mobile generateProfessionalInvoiceHtml)

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  paymentMethod?: string;
  items: ReceiptItem[];
  subtotal: number;
  vatAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  receiptType?: 'RECEIPT' | 'INVOICE' | 'EXPENSE';
  notes?: string;
}

function formatN(n: number): string {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── 80mm Monospace Receipt (unchanged) ───────────────────────────────────────

export function openReceiptPrintWindow(data: ReceiptData): void {
  const {
    businessName, businessAddress, businessPhone,
    invoiceNo, date, customerName, paymentMethod,
    items, subtotal, vatAmount = 0, discountAmount = 0, grandTotal,
    receiptType = 'RECEIPT', notes,
  } = data;

  const dateStr = date || new Date().toLocaleDateString('en-GB');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${receiptType} - ${businessName}</title>
<style>
  @page { size: 80mm auto; margin: 4mm 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.5;
    color: #000;
    width: 72mm;
    background: #fff;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: bold; }
  .large   { font-size: 14px; }
  .sep     { border-top: 1px dashed #000; margin: 4px 0; }
  .sep-solid { border-top: 1px solid #000; margin: 4px 0; }
  .row     { display: flex; justify-content: space-between; }
  .item-name { flex: 1; word-break: break-word; }
  .total-row { display: flex; justify-content: space-between; padding: 1px 0; }
  .grand-total { font-weight: bold; font-size: 13px; }
  .footer  { text-align: center; margin-top: 8px; font-size: 10px; }
  @media screen {
    body { background: #f5f5f5; }
    .receipt-wrap {
      background: #fff;
      margin: 20px auto;
      padding: 12px;
      width: 80mm;
      box-shadow: 0 2px 8px rgba(0,0,0,.2);
    }
  }
</style>
</head>
<body>
<div class="receipt-wrap">
  <div class="center bold large">${businessName}</div>
  ${businessAddress ? `<div class="center">${businessAddress}</div>` : ''}
  ${businessPhone  ? `<div class="center">${businessPhone}</div>` : ''}
  <div class="sep-solid"></div>
  <div class="center bold">${receiptType === 'INVOICE' ? 'INVOICE' : receiptType === 'EXPENSE' ? 'EXPENSE' : 'RECEIPT'}</div>
  ${invoiceNo ? `<div class="center">Ref: ${invoiceNo}</div>` : ''}
  <div class="center">${dateStr}</div>
  ${customerName ? `<div class="sep"></div><div>Customer: <span class="bold">${customerName}</span></div>` : ''}
  ${paymentMethod ? `<div>Payment: ${paymentMethod}</div>` : ''}
  <div class="sep-solid"></div>
  ${items.map(item => `
    <div>
      <div class="item-name bold">${item.name}</div>
      <div class="row">
        <span>${item.quantity} × ${formatN(item.unitPrice)}</span>
        <span>${formatN(item.total)}</span>
      </div>
    </div>
  `).join('')}
  <div class="sep-solid"></div>
  <div class="total-row"><span>Subtotal</span><span>${formatN(subtotal)}</span></div>
  ${discountAmount > 0 ? `<div class="total-row"><span>Discount</span><span>-${formatN(discountAmount)}</span></div>` : ''}
  ${vatAmount > 0     ? `<div class="total-row"><span>VAT</span><span>${formatN(vatAmount)}</span></div>` : ''}
  <div class="sep"></div>
  <div class="total-row grand-total"><span>TOTAL</span><span>${formatN(grandTotal)}</span></div>
  <div class="sep-solid"></div>
  ${notes ? `<div style="margin-top:4px;font-size:10px;">${notes}</div><div class="sep"></div>` : ''}
  <div class="footer">Thank you for your business!<br/>Powered by EasePay</div>
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 300); };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600,menubar=no,toolbar=no,location=no');
  if (!win) { alert('Please allow popups for this site to use the print feature.'); return; }
  win.document.write(html);
  win.document.close();
}

// ── Thermal Receipt (58mm / 80mm) — port of mobile generateThermalReceiptHtml ──

export function openThermalPrintWindow(data: ReceiptData, paperWidth: 58 | 80 = 80): void {
  const {
    businessName, businessAddress, businessPhone,
    invoiceNo, date, customerName, paymentMethod,
    items, subtotal, vatAmount = 0, discountAmount = 0, grandTotal,
    receiptType = 'RECEIPT', notes,
  } = data;

  const pw = paperWidth === 58 ? '58mm' : '80mm';
  const dateStr = date || new Date().toLocaleDateString('en-GB');
  const typeLabel = receiptType === 'INVOICE' ? 'INVOICE' : receiptType === 'EXPENSE' ? 'EXPENSE' : 'RECEIPT';

  const N = (n: number) => `N${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="width:65%;word-break:break-word;vertical-align:top;padding:2px 0">
        ${item.name}<br/><span style="font-size:10px">${item.quantity} x ${N(item.unitPrice)}</span>
      </td>
      <td style="width:35%;text-align:right;white-space:nowrap;vertical-align:top;padding:2px 0">
        ${N(item.total)}
      </td>
    </tr>`).join('');

  const receiptBody = `
    <div style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.4;color:#000;padding:2mm">
      <div style="text-align:center">
        <div style="font-size:15px;font-weight:bold;margin-bottom:3px">${businessName}</div>
        ${businessAddress ? `<div style="font-size:10px">${businessAddress}</div>` : ''}
        ${businessPhone   ? `<div style="font-size:10px">${businessPhone}</div>`   : ''}
      </div>
      <div style="border-top:1px dashed #000;margin:4px 0"></div>
      <div>
        ${invoiceNo ? `<div>${typeLabel} #: ${invoiceNo}</div>` : ''}
        <div>DATE: ${dateStr}</div>
        <div>CUST: ${customerName || 'Walk-in'}</div>
        ${paymentMethod ? `<div>PAY: ${paymentMethod}</div>` : ''}
      </div>
      <div style="border-top:1px dashed #000;margin:4px 0"></div>
      <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
      <div style="border-top:1px dashed #000;margin:4px 0"></div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:2px 0">Subtotal</td><td style="text-align:right;padding:2px 0">${N(subtotal)}</td></tr>
        ${vatAmount > 0      ? `<tr><td style="padding:2px 0">VAT (7.5%)</td><td style="text-align:right;padding:2px 0">${N(vatAmount)}</td></tr>` : ''}
        ${discountAmount > 0 ? `<tr><td style="padding:2px 0">Discount</td><td style="text-align:right;padding:2px 0">-${N(discountAmount)}</td></tr>` : ''}
        ${paymentMethod      ? `<tr><td style="padding:2px 0">Payment</td><td style="text-align:right;padding:2px 0">${paymentMethod}</td></tr>` : ''}
        <tr>
          <td style="font-weight:bold;padding:2px 0">TOTAL</td>
          <td style="text-align:right;font-weight:bold;padding:2px 0">${N(grandTotal)}</td>
        </tr>
      </table>
      ${notes ? `<div style="border-top:1px dashed #000;margin:4px 0"></div><div style="font-size:10px">${notes}</div>` : ''}
      <div style="border-top:1px dashed #000;margin:4px 0"></div>
      <div style="text-align:center;font-size:10px;margin-top:6px">Thank you for your business!</div>
      <br/><br/><br/>
    </div>`;

  // Full HTML page — opens in a new tab with an explicit Print button.
  // No auto-print: user clicks the button which calls window.print() from a real gesture.
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Receipt</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @media print {
      @page { size: ${pw} auto; margin: 2mm; }
      .no-print { display: none !important; }
      body { background: #fff; }
    }
    @media screen {
      body { background: #f0f0f0; padding: 16px; font-family: sans-serif; }
      .no-print { margin-bottom: 12px; }
      .receipt-wrap {
        background: #fff;
        width: ${pw};
        max-width: 100%;
        margin: 0 auto;
        padding: 4mm;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        border-radius: 4px;
      }
      .print-btn {
        display: block;
        width: 100%;
        max-width: ${pw};
        margin: 0 auto 8px;
        padding: 12px;
        background: #050A30;
        color: #fff;
        font-size: 15px;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .hint {
        display: block;
        width: 100%;
        max-width: ${pw};
        margin: 0 auto;
        text-align: center;
        font-size: 11px;
        color: #666;
        margin-bottom: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">Print Receipt</button>
    <span class="hint">In the print dialog: select your thermal printer &bull; set paper to ${pw}</span>
  </div>
  <div class="receipt-wrap">${receiptBody}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const tab  = window.open(url, '_blank');
  if (tab) {
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return;
  }
  // Fallback if tab was blocked — write into current window
  document.write(html);
}

// ── A4 Professional Invoice — port of mobile generateProfessionalInvoiceHtml ──

export interface InvoicePrintData {
  // Business
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  businessEmail?: string;
  businessLogo?: string;
  businessRcNumber?: string;
  businessBnNumber?: string;
  businessTaxId?: string;
  // Invoice meta
  invoiceNo?: string;
  date?: string;
  dueDate?: string;
  publicToken?: string;
  qrCodeDataUri?: string; // pre-generated QR data URL from server or generated client-side
  // Customer
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  // Payment
  paymentMethod?: string;
  status?: string;
  // Line items
  items: { name: string; description?: string; quantity: number; unitPrice: number; total: number }[];
  // Totals
  subtotal: number;
  vatAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  amountPaid?: number;
  // Footer
  notes?: string;
  terms?: string;
  accountDetails?: string;
  // Template customisation (from localStorage invoiceTemplateSettings)
  accentColor?: string;
  signatureUri?: string;
  // Type
  type?: 'INVOICE' | 'RECEIPT' | 'SALE' | 'EXPENSE';
}

// Reads invoice template settings from localStorage — same key pattern as mobile app.
// Safe to call on server (returns defaults) or before the user object is available.
export function readInvoiceTemplateSettings(user: any): {
  accentColor: string; footerText: string;
  termsAndConditions: string; accountDetails: string; signatureUri: string;
} {
  const defaults = { accentColor: '#050A30', footerText: '', termsAndConditions: '', accountDetails: '', signatureUri: '' };
  if (typeof window === 'undefined') return defaults;
  try {
    const uid = user?.id || user?.userId || user?.email || 'default';
    const raw = localStorage.getItem(`invoiceTemplateSettings_${uid}`);
    if (!raw) return defaults;
    const s = JSON.parse(raw);
    return {
      accentColor:        s.accentColor        || defaults.accentColor,
      footerText:         s.footerText         || defaults.footerText,
      termsAndConditions: s.termsAndConditions || defaults.termsAndConditions,
      accountDetails:     s.accountDetails     || defaults.accountDetails,
      signatureUri:       s.signatureUri       || defaults.signatureUri,
    };
  } catch { return defaults; }
}

function getStatusStyle(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid')          return 'background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7;';
  if (s === 'unpaid')        return 'background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;';
  if (s.includes('partial')) return 'background:#DBEAFE;color:#1E40AF;border:1px solid #93C5FD;';
  if (s === 'draft')         return 'background:#F3F4F6;color:#374151;border:1px solid #D1D5DB;';
  if (s === 'overdue')       return 'background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5;';
  if (s === 'sent')          return 'background:#DBEAFE;color:#1D4ED8;border:1px solid #93C5FD;';
  return 'background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;';
}

// ── Invoice HTML builder (shared by print window + PDF generation) ───────────

function buildInvoicePageHtml(data: InvoicePrintData, autoprint = true): string {
  const {
    businessName, businessPhone, businessAddress, businessEmail,
    businessLogo, businessRcNumber, businessBnNumber, businessTaxId,
    invoiceNo, date, dueDate, publicToken, qrCodeDataUri,
    customerName, customerEmail, customerPhone, customerAddress,
    paymentMethod, status, items, subtotal,
    vatAmount = 0, discountAmount = 0, grandTotal, amountPaid,
    notes, terms, accountDetails, accentColor, signatureUri, type = 'INVOICE',
  } = data;

  const accent = accentColor || '#050A30';
  const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateStr = date ? new Date(date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
  const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-GB') : '';
  const hasDiscount = discountAmount > 0;
  const hasVat = vatAmount > 0;
  const isPartial = !!(status?.toLowerCase().includes('partial') && amountPaid && amountPaid > 0);
  const balanceDue = isPartial ? Math.max(0, grandTotal - amountPaid!) : 0;
  const docLabel = type === 'SALE' ? 'RECEIPT' : type;
  const pmLabel = paymentMethod === 'CASH' ? 'Cash'
    : paymentMethod === 'TRANSFER' ? 'Bank Transfer'
    : paymentMethod === 'POS' ? 'POS / Card'
    : paymentMethod || 'N/A';

  const logoHtml = businessLogo
    ? `<img src="${businessLogo}" crossorigin="anonymous" alt="${businessName}" style="height:80px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px;" />`
    : `<div style="height:80px;max-width:200px;display:flex;align-items:center;margin-bottom:8px;">
        <span style="font-size:26px;font-weight:900;color:${accent};letter-spacing:1px;text-transform:uppercase;line-height:1.1;">${businessName}</span>
       </div>`;

  const regBadges = [
    businessRcNumber ? `<span style="font-size:11px;color:#6B7280;background:#F3F4F6;border-radius:4px;padding:2px 8px;font-weight:600;">RC: ${businessRcNumber}</span>` : '',
    businessBnNumber ? `<span style="font-size:11px;color:#6B7280;background:#F3F4F6;border-radius:4px;padding:2px 8px;font-weight:600;">BN: ${businessBnNumber}</span>` : '',
    businessTaxId    ? `<span style="font-size:11px;color:#6B7280;background:#F3F4F6;border-radius:4px;padding:2px 8px;font-weight:600;">TIN: ${businessTaxId}</span>` : '',
  ].filter(Boolean).join('');

  // Prefer pre-generated QR data URL (set by generateInvoicePdfBlob) over external API URL
  const qrSrc = qrCodeDataUri ||
    (publicToken ? `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('https://easepay-backend.onrender.com/i/' + publicToken)}` : '');

  const itemsHtml = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#F9FAFB'};border-bottom:1px solid #F3F4F6;">
      <td style="padding:14px 16px;color:#111827;font-weight:500;font-size:13px;width:100%;border-collapse:collapse;">
        ${item.name}
        ${item.description ? `<br/><span style="font-size:11px;color:#6B7280;">${item.description}</span>` : ''}
      </td>
      <td style="padding:14px 12px;color:#4B5563;text-align:center;font-size:13px;white-space:nowrap;">${item.quantity}</td>
      <td style="padding:14px 12px;color:#4B5563;text-align:right;font-size:13px;white-space:nowrap;">${fmt(item.unitPrice)}</td>
      <td style="padding:14px 16px;color:#111827;text-align:right;font-weight:700;font-size:13px;white-space:nowrap;">${fmt(item.total)}</td>
    </tr>`).join('');

  const docBody = `
  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:3px solid ${accent};margin-bottom:36px;gap:24px;">
    <div style="flex:1;">
      ${logoHtml}
      ${businessLogo ? `<p style="font-size:15px;font-weight:800;color:#111827;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${businessName}</p>` : ''}
      ${regBadges ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px;">${regBadges}</div>` : ''}
      <div>
        ${businessEmail   ? `<p style="font-size:12px;color:#4B5563;margin:2px 0;">&#9993;&nbsp; ${businessEmail}</p>` : ''}
        ${businessPhone   ? `<p style="font-size:12px;color:#4B5563;margin:2px 0;">&#9742;&nbsp; ${businessPhone}</p>` : ''}
        ${businessAddress ? `<p style="font-size:12px;color:#4B5563;margin:2px 0;">&#9679;&nbsp; ${businessAddress}</p>` : ''}
      </div>
    </div>
    <div style="text-align:right;min-width:220px;">
      <p style="font-size:40px;font-weight:900;color:#111827;letter-spacing:3px;text-transform:uppercase;line-height:1;margin-bottom:12px;">${docLabel}</p>
      <div>
        <p style="font-size:12px;color:#6B7280;margin:4px 0;">No: <strong style="color:${accent};font-size:13px;">#${invoiceNo || '—'}</strong></p>
        <p style="font-size:12px;color:#6B7280;margin:4px 0;">Date: ${dateStr}</p>
        ${dueDateStr ? `<p style="font-size:12px;color:#6B7280;margin:4px 0;">Due: ${dueDateStr}</p>` : ''}
        ${status ? `<p style="margin-top:10px;"><span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;${getStatusStyle(status)}">${status}</span></p>` : ''}
      </div>
      ${qrSrc ? `
      <div style="margin-top:12px;display:inline-block;text-align:center;">
        <img src="${qrSrc}" crossorigin="anonymous" style="width:80px;height:80px;display:block;border-radius:6px;" />
        <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;">Scan to view</p>
      </div>` : ''}
    </div>
  </div>

  <!-- BILL TO / PAYMENT -->
  <div style="display:flex;justify-content:space-between;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:20px 24px;margin-bottom:32px;gap:20px;flex-wrap:wrap;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:6px;font-weight:700;">Billed To</div>
      <div style="font-size:15px;font-weight:700;color:#111827;">${customerName || 'Walk-in Customer'}</div>
      ${customerEmail   ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerEmail}</div>` : ''}
      ${customerPhone   ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerPhone}</div>` : ''}
      ${customerAddress ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerAddress}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:6px;font-weight:700;">Payment Method</div>
      <div style="font-size:15px;font-weight:700;color:#111827;">${pmLabel}</div>
    </div>
  </div>

  <!-- LINE ITEMS -->
  <div style="border-radius:10px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:32px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:${accent};">
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:left;">Description</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:center;white-space:nowrap;">Qty</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:right;white-space:nowrap;">Unit Price</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:right;white-space:nowrap;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <!-- SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:40px;">
    <div style="width:360px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${hasDiscount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>Discount</span><span style="color:#DC2626;">-${fmt(discountAmount)}</span></div>` : ''}
      ${hasVat      ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>VAT (7.5%)</span><span style="color:#059669;">+${fmt(vatAmount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;border-top:2px solid #E5E7EB;margin-top:10px;padding-top:14px;font-size:18px;font-weight:800;color:${accent};"><span>Grand Total</span><span>${fmt(grandTotal)}</span></div>
      ${isPartial ? `
      <div style="margin-top:14px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="font-weight:600;color:#374151;">Amount Paid</span><span style="font-weight:700;color:#059669;">${fmt(amountPaid!)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="font-weight:600;color:#374151;">Balance Due</span><span style="font-weight:800;color:#DC2626;font-size:15px;">${fmt(balanceDue)}</span></div>
      </div>` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E5E7EB;padding-top:24px;font-size:11px;color:#6B7280;">
    ${accountDetails ? `<div style="margin-bottom:18px;"><strong style="font-size:12px;color:#374151;display:block;margin-bottom:4px;">Bank / Account Details</strong><p style="margin:0;white-space:pre-line;">${accountDetails.replace(/\n/g,'<br/>')}</p></div>` : ''}
    ${terms ? `<div style="margin-bottom:18px;"><strong style="font-size:12px;color:#374151;display:block;margin-bottom:4px;">Terms &amp; Conditions</strong><p style="margin:0;white-space:pre-line;">${terms.replace(/\n/g,'<br/>')}</p></div>` : ''}
    ${notes ? `<div style="margin-bottom:14px;"><strong style="font-size:12px;color:#374151;display:block;margin-bottom:4px;">Note</strong><p style="margin:0;">${notes}</p></div>` : ''}
    ${signatureUri ? `
    <div style="margin-bottom:18px;border-top:1px solid #E5E7EB;padding-top:16px;">
      <strong style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:8px;">Authorized Signature</strong>
      <img src="${signatureUri}" crossorigin="anonymous" style="max-height:70px;max-width:220px;object-fit:contain;display:block;margin-bottom:6px;" />
      <div style="border-top:1px solid #9CA3AF;width:220px;"></div>
    </div>` : ''}
    <p style="margin-top:8px;">This is a computer-generated ${(docLabel || 'invoice').toLowerCase()}. All transactions are final unless otherwise stated.</p>
    <span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;border-radius:20px;padding:5px 14px;font-size:10px;font-weight:700;letter-spacing:0.5px;margin-top:12px;">&#10003;&nbsp; Verified &bull; Secured by EasePay</span>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${docLabel} #${invoiceNo || ''} — ${businessName}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; line-height: 1.6; }
  @media screen { body { background: #f3f4f6; } .doc { max-width: 794px; margin: 24px auto; padding: 48px 56px; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.12); border-radius: 8px; } }
  @media print { .no-print { display:none; } }
</style>
</head>
<body>
<div class="doc">${docBody}</div>
${autoprint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>' : ''}
</body>
</html>`;
}

// Opens invoice in a print-preview popup (Blob URL — avoids about:blank + popup-blocker after async)
export function openInvoicePrintWindow(data: InvoicePrintData): void {
  const html = buildInvoicePageHtml(data, true);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=960,height=720,menubar=no,toolbar=no,location=no,scrollbars=yes');
  if (!win) { alert('Please allow popups for this site to print.'); URL.revokeObjectURL(url); return; }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Converts an http(s) URL to a base64 data URL via fetch.
// Eliminates CORS / timing issues when html2canvas renders remote images.
async function urlToDataUrl(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return await new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = () => res(url); // fallback to original on error
      reader.readAsDataURL(blob);
    });
  } catch { return url; }
}

// Generates a real PDF blob from the invoice using html2canvas + jsPDF (mirrors mobile Print.printToFileAsync)
export async function generateInvoicePdfBlob(data: InvoicePrintData): Promise<Blob> {
  // Pre-convert every remote image to a base64 data URL so html2canvas never
  // makes a cross-origin network request (eliminates CORS errors and timing races).
  let pdfData = { ...data };
  const jobs: Promise<void>[] = [];

  let logoDataUrl = data.businessLogo;
  let sigDataUrl  = data.signatureUri;
  let qrDataUrl   = data.qrCodeDataUri;

  if (logoDataUrl?.startsWith('http')) jobs.push(urlToDataUrl(logoDataUrl).then(u => { logoDataUrl = u; }));
  if (sigDataUrl?.startsWith('http'))  jobs.push(urlToDataUrl(sigDataUrl).then(u => { sigDataUrl  = u; }));
  if (qrDataUrl?.startsWith('http'))   jobs.push(urlToDataUrl(qrDataUrl).then(u => { qrDataUrl   = u; }));

  // If no QR data URL yet but we have a publicToken, generate the QR client-side
  // using the qrcode npm package — no external service, no CORS issues.
  if (!qrDataUrl && data.publicToken) {
    jobs.push(
      import('qrcode').then(mod => {
        const QRCode = mod.default ?? mod;
        return (QRCode as any).toDataURL(
          `https://easepay-backend.onrender.com/i/${data.publicToken}`,
          { width: 160, margin: 1, color: { dark: '#000000', light: '#ffffff' } }
        );
      }).then((url: string) => { qrDataUrl = url; }).catch(() => {})
    );
  }

  await Promise.all(jobs);
  pdfData = { ...data, businessLogo: logoDataUrl, signatureUri: sigDataUrl, qrCodeDataUri: qrDataUrl };

  const [jspdfMod, h2cMod] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const { jsPDF } = jspdfMod;
  const html2canvas = h2cMod.default;

  const htmlPage = buildInvoicePageHtml(pdfData, false);

  // Extract <style> block — keep only base rules, strip @media queries that break pdf rendering
  const styleMatch = htmlPage.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const baseStyles = styleMatch
    ? styleMatch[1].replace(/@media\s[^{]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
    : '';

  // Extract <body> content
  const bodyMatch = htmlPage.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch
    ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '')
    : '';

  // ── Loading overlay ─────────────────────────────────────────────────────────
  // Covers the full page while we render — hides both the 794px render container
  // and the brief DOM changes html2canvas makes during capture (which otherwise
  // cause the UI to visually shrink/jump on mobile).
  const overlay = document.createElement('div');
  overlay.setAttribute('data-pdf-overlay', '1'); // onclone removes this from the clone
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(255,255,255,0.97);' +
    'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;';
  overlay.innerHTML =
    '<div style="width:44px;height:44px;border:4px solid #E5E7EB;border-top-color:#050A30;' +
    'border-radius:50%;animation:_pdf_spin 0.75s linear infinite;"></div>' +
    '<p style="font-family:system-ui,sans-serif;font-size:15px;font-weight:600;color:#050A30;margin:0;">' +
    'Generating PDF…</p>' +
    '<style>@keyframes _pdf_spin{to{transform:rotate(360deg);}}</style>';
  document.body.appendChild(overlay);

  // ── Render container ─────────────────────────────────────────────────────────
  // Must be at top:0 left:0 (in viewport) so the browser renders it fully.
  // Hidden behind the overlay (z-index one below) so user only sees the spinner.
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;top:0;left:0;width:794px;z-index:2147483646;background:#fff;pointer-events:none;opacity:0.001;';

  // Inject extracted styles (so table borders, etc. apply)
  const styleEl = document.createElement('style');
  styleEl.textContent = baseStyles;
  wrapper.appendChild(styleEl);

  // Inject body content
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = bodyContent;

  // Override .doc class — remove screen-only decorations that don't belong in PDF
  const docEl = contentDiv.querySelector('.doc') as HTMLElement | null;
  if (docEl) {
    docEl.style.cssText = 'padding:48px 56px;background:#fff;margin:0;box-shadow:none;border-radius:0;';
  }

  wrapper.appendChild(contentDiv);
  document.body.appendChild(wrapper);

  // Wait for images (logo, QR code) to finish loading
  const imgs = Array.from(wrapper.querySelectorAll('img'));
  await Promise.all(
    imgs.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); })
    )
  );

  // Brief settle time for layout engine
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
      onclone: (_clonedDoc: Document, clonedEl: HTMLElement) => {
        // Remove the loading overlay from the clone — it sits above the wrapper in z-index,
        // so without this html2canvas captures the white overlay instead of invoice content.
        _clonedDoc.querySelectorAll('[data-pdf-overlay]').forEach(n => n.remove());
        // Restore full opacity in the clone (live DOM uses 0.001 to stay hidden from user).
        clonedEl.style.opacity = '1';
      },
    });

    // A4 dimensions in mm — most reliable across jsPDF versions
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // 210 mm
    const pageH = pdf.internal.pageSize.getHeight();  // 297 mm
    const imgH  = (canvas.height * pageW) / canvas.width; // proportional height in mm
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgH);
    } else {
      // Multi-page: slice at each page boundary
      let yMm = 0;
      while (yMm < imgH) {
        if (yMm > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yMm, pageW, imgH);
        yMm += pageH;
      }
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrapper);
    document.body.removeChild(overlay);
  }
}

// Downloads the invoice as a real PDF file (no print dialog — saves to Downloads folder)
export async function downloadInvoicePdf(data: InvoicePrintData, filename?: string): Promise<void> {
  const blob = await generateInvoicePdfBlob(data);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: filename || `Invoice-${data.invoiceNo || Date.now()}.pdf`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Shares invoice PDF — Web Share API on mobile, straight download on desktop.
// Returns 'shared' when the OS share sheet handled it, 'downloaded' when PDF was saved locally.
export async function shareInvoicePdfViaWhatsApp(
  data: InvoicePrintData,
  filename?: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await generateInvoicePdfBlob(data);
  const pdfName = filename || `Invoice-${data.invoiceNo || Date.now()}.pdf`;
  const file = new File([blob], pdfName, { type: 'application/pdf' });

  // Mobile browsers (Chrome Android, Safari iOS) — open native share sheet
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: pdfName });
        return 'shared';
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'shared'; // user cancelled share sheet
    }
  }

  // Desktop — download the PDF file; calling code handles any messaging
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: pdfName });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(message: string): void {
  const url = buildWhatsAppUrl(message);
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

export function buildSaleWhatsAppMessage(opts: {
  businessName: string;
  customerName?: string;
  amount: number;
  receiptUrl?: string;
  invoiceNo?: string;
  items?: { name: string; quantity: number; unitPrice: number }[];
}): string {
  const { businessName, customerName, amount, receiptUrl, invoiceNo, items } = opts;
  const greeting = customerName ? `Hello ${customerName},\n\n` : '';
  const ref = invoiceNo ? ` (Ref: ${invoiceNo})` : '';
  const itemLines = items?.length
    ? '\n\nItems:\n' + items.map(i => `• ${i.name} × ${i.quantity} — ${formatN(i.unitPrice * i.quantity)}`).join('\n')
    : '';
  const linkLine = receiptUrl ? `\n\nReceipt: ${receiptUrl}` : '';
  return `${greeting}Thank you for your purchase from *${businessName}*${ref}.\n\nTotal: *${formatN(amount)}*${itemLines}${linkLine}`;
}

export function buildInvoiceWhatsAppMessage(opts: {
  businessName: string;
  customerName?: string;
  amount: number;
  invoiceUrl: string;
  invoiceNo?: string;
  dueDate?: string;
}): string {
  const { businessName, customerName, amount, invoiceUrl, invoiceNo, dueDate } = opts;
  const greeting = customerName ? `Hello ${customerName},\n\n` : '';
  const ref = invoiceNo ? `Invoice #${invoiceNo}` : 'Your invoice';
  const due = dueDate ? `\nDue Date: ${dueDate}` : '';
  return `${greeting}${ref} from *${businessName}* is ready.\n\nAmount Due: *${formatN(amount)}*${due}\n\nView & pay here: ${invoiceUrl}`;
}
