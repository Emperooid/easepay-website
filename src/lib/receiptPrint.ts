// Web equivalent of mobile's ThermalPrintModal + ESC/POS receipt generation.
// Opens a styled receipt in a new browser window so users can print it on
// any printer (USB thermal, network printer, or save as PDF).

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

function pad(left: string, right: string, width = 32): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function line(char = '-', width = 32): string {
  return char.repeat(width);
}

export function openReceiptPrintWindow(data: ReceiptData): void {
  const {
    businessName, businessAddress, businessPhone,
    invoiceNo, date, customerName, paymentMethod,
    items, subtotal, vatAmount = 0, discountAmount = 0, grandTotal,
    receiptType = 'RECEIPT', notes,
  } = data;

  const dateStr = date || new Date().toLocaleDateString('en-GB');
  const w = 32; // character width for the receipt

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
  .item-total { white-space: nowrap; margin-left: 8px; }
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

  <div class="footer">
    Thank you for your business!<br/>
    Powered by EasePay
  </div>
</div>
<script>
  window.onload = function() {
    // Small delay so fonts render before print dialog opens
    setTimeout(function() { window.print(); }, 300);
  };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600,menubar=no,toolbar=no,location=no');
  if (!win) {
    alert('Please allow popups for this site to use the print feature.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── A4 / Professional Invoice Print ─────────────────────────────────────────

export interface InvoicePrintData {
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  invoiceNo?: string;
  date?: string;
  dueDate?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentMethod?: string;
  status?: string;
  items: { name: string; description?: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  vatAmount?: number;
  discountAmount?: number;
  grandTotal: number;
  amountPaid?: number;
  notes?: string;
  terms?: string;
  type?: 'INVOICE' | 'RECEIPT' | 'SALE' | 'EXPENSE';
}

function a4StatusStyle(status: string): string {
  const s = status?.toUpperCase();
  if (s === 'PAID') return 'background:#DCFCE7;color:#15803D;';
  if (s === 'OVERDUE') return 'background:#FEE2E2;color:#DC2626;';
  if (s === 'DRAFT') return 'background:#F3F4F6;color:#6B7280;';
  if (s === 'SENT') return 'background:#DBEAFE;color:#1D4ED8;';
  if (s.includes('PARTIAL')) return 'background:#FEF3C7;color:#D97706;';
  if (s === 'CANCELLED') return 'background:#F3F4F6;color:#6B7280;';
  return 'background:#FEF9C3;color:#854D0E;';
}

export function openInvoicePrintWindow(data: InvoicePrintData): void {
  const {
    businessName, businessPhone, businessAddress,
    invoiceNo, date, dueDate,
    customerName, customerEmail, customerPhone, customerAddress,
    paymentMethod, status, items, subtotal,
    vatAmount = 0, discountAmount = 0, grandTotal, amountPaid,
    notes, terms, type = 'INVOICE',
  } = data;

  const accent = '#050A30';
  const fmt = (n: number) =>
    `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateStr = date || new Date().toLocaleDateString('en-GB');
  const hasDiscount = discountAmount > 0;
  const hasVat = vatAmount > 0;
  const isPartial = !!status?.toLowerCase().includes('partial') && !!amountPaid && amountPaid > 0;
  const balanceDue = isPartial ? Math.max(0, grandTotal - amountPaid!) : 0;
  const docLabel = type === 'SALE' ? 'RECEIPT' : type;
  const pmLabel = paymentMethod === 'CASH' ? 'Cash'
    : paymentMethod === 'TRANSFER' ? 'Bank Transfer'
    : paymentMethod === 'POS' ? 'POS / Card'
    : paymentMethod || 'N/A';

  const itemsHtml = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#F9FAFB'};">
      <td style="padding:12px 16px;font-size:13px;color:#111827;border-bottom:1px solid #F3F4F6;">
        <strong>${item.name}</strong>
        ${item.description ? `<br/><span style="color:#6B7280;font-size:11px;">${item.description}</span>` : ''}
      </td>
      <td style="padding:12px 16px;text-align:center;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${item.quantity}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;color:#374151;border-bottom:1px solid #F3F4F6;">${fmt(item.unitPrice)}</td>
      <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:700;color:#111827;border-bottom:1px solid #F3F4F6;">${fmt(item.total)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${docLabel} - ${businessName}</title>
<style>
  @page { size: A4; margin: 16mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #374151; background: #fff; }
  table { width: 100%; border-collapse: collapse; }
  @media screen {
    body { background: #f3f4f6; }
    .doc { max-width: 794px; margin: 24px auto; padding: 40px 48px; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.12); border-radius: 8px; }
  }
</style>
</head>
<body>
<div class="doc">

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:24px;border-bottom:3px solid ${accent};margin-bottom:32px;gap:20px;">
    <div>
      <div style="font-size:20px;font-weight:800;color:#111827;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${businessName}</div>
      ${businessPhone ? `<div style="font-size:12px;color:#6B7280;margin-top:3px;">&#9742; ${businessPhone}</div>` : ''}
      ${businessAddress ? `<div style="font-size:12px;color:#6B7280;margin-top:3px;">&#9679; ${businessAddress}</div>` : ''}
    </div>
    <div style="text-align:right;min-width:200px;">
      <div style="font-size:36px;font-weight:900;color:#111827;letter-spacing:3px;text-transform:uppercase;line-height:1;margin-bottom:12px;">${docLabel}</div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px;">No: <strong style="color:${accent};font-size:13px;">#${invoiceNo || '—'}</strong></div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px;">Date: ${dateStr}</div>
      ${dueDate ? `<div style="font-size:12px;color:#6B7280;margin-top:4px;">Due: ${dueDate}</div>` : ''}
      ${status ? `<div style="margin-top:10px;"><span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;${a4StatusStyle(status)}">${status}</span></div>` : ''}
    </div>
  </div>

  <!-- BILL TO / PAYMENT -->
  <div style="display:flex;justify-content:space-between;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:20px 24px;margin-bottom:28px;gap:20px;flex-wrap:wrap;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:6px;font-weight:700;">Billed To</div>
      <div style="font-size:15px;font-weight:700;color:#111827;">${customerName || 'Walk-in Customer'}</div>
      ${customerEmail ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerEmail}</div>` : ''}
      ${customerPhone ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerPhone}</div>` : ''}
      ${customerAddress ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${customerAddress}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#9CA3AF;margin-bottom:6px;font-weight:700;">Payment Method</div>
      <div style="font-size:15px;font-weight:700;color:#111827;">${pmLabel}</div>
    </div>
  </div>

  <!-- LINE ITEMS -->
  <div style="border-radius:10px;overflow:hidden;border:1px solid #E5E7EB;margin-bottom:28px;">
    <table>
      <thead>
        <tr style="background:${accent};">
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:left;">Description</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:center;">Qty</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:right;">Unit Price</th>
          <th style="color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;padding:13px 16px;font-weight:700;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <!-- SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
    <div style="width:340px;background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;padding:20px 24px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      ${hasDiscount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>Discount</span><span style="color:#DC2626;">-${fmt(discountAmount)}</span></div>` : ''}
      ${hasVat ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#4B5563;"><span>VAT</span><span style="color:#059669;">+${fmt(vatAmount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding-top:14px;margin-top:10px;border-top:2px solid #E5E7EB;font-size:18px;font-weight:800;color:${accent};"><span>Grand Total</span><span>${fmt(grandTotal)}</span></div>
      ${isPartial ? `
      <div style="margin-top:14px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:12px 16px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="font-weight:600;color:#374151;">Amount Paid</span><span style="font-weight:700;color:#059669;">${fmt(amountPaid!)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;"><span style="font-weight:600;color:#374151;">Balance Due</span><span style="font-weight:800;color:#DC2626;font-size:15px;">${fmt(balanceDue)}</span></div>
      </div>` : ''}
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #E5E7EB;padding-top:20px;font-size:11px;color:#6B7280;">
    ${notes ? `<div style="margin-bottom:14px;"><strong style="font-size:12px;color:#374151;display:block;margin-bottom:4px;">Notes</strong>${notes}</div>` : ''}
    ${terms ? `<div style="margin-bottom:14px;"><strong style="font-size:12px;color:#374151;display:block;margin-bottom:4px;">Terms &amp; Conditions</strong>${terms}</div>` : ''}
    <p>This is a computer-generated ${docLabel.toLowerCase()}. All transactions are final unless otherwise stated.</p>
    <span style="display:inline-block;background:#EFF6FF;color:#1D4ED8;border-radius:20px;padding:5px 14px;font-size:10px;font-weight:700;letter-spacing:0.5px;margin-top:12px;">&#10003;&nbsp; Verified &bull; Secured by EasePay</span>
  </div>

</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 400); };
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700,menubar=no,toolbar=no,location=no');
  if (!win) {
    alert('Please allow popups for this site to use the print feature.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── WhatsApp ─────────────────────────────────────────────────────────────────

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(message: string): void {
  const url = buildWhatsAppUrl(message);
  // Use a programmatic link click — avoids popup blockers that block window.open
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
