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

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildSaleWhatsAppMessage(opts: {
  businessName: string;
  customerName?: string;
  amount: number;
  receiptUrl: string;
  invoiceNo?: string;
}): string {
  const { businessName, customerName, amount, receiptUrl, invoiceNo } = opts;
  const greeting = customerName ? `Hello ${customerName}! ` : '';
  const ref = invoiceNo ? ` (Ref: ${invoiceNo})` : '';
  return `${greeting}Thank you for your purchase from *${businessName}*${ref}.\n\nTotal: *${formatN(amount)}*\n\nView your receipt here: ${receiptUrl}`;
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
