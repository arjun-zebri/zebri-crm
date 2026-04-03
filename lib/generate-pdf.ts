export interface PdfLineItem {
  description: string
  amount?: number
  quantity?: number
  unit_price?: number
}

export interface PdfDocumentData {
  type: 'quote' | 'invoice'
  documentNumber: string
  title: string
  status: string
  coupleName: string
  businessName?: string
  items: PdfLineItem[]
  subtotal: number
  discountType?: 'percentage' | 'fixed' | null
  discountValue?: number | null
  taxRate?: number
  total: number
  notes?: string | null
  // Quote specific
  expiresAt?: string | null
  // Invoice specific
  dueDate?: string | null
  bankAccountName?: string | null
  bankBsb?: string | null
  bankAccountNumber?: string | null
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function generateAndPrintPdf(doc: PdfDocumentData) {
  const discountAmount =
    doc.discountType && doc.discountValue && doc.discountValue > 0
      ? doc.discountType === 'percentage'
        ? doc.subtotal * doc.discountValue / 100
        : doc.discountValue
      : 0
  const taxableAmount = doc.subtotal - discountAmount
  const taxRate = doc.taxRate ?? 0
  const tax = taxableAmount * (taxRate / 100)

  const itemRows = doc.items
    .map((item) => {
      if (doc.type === 'invoice' && item.quantity != null && item.unit_price != null) {
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111">${item.description || '—'}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111;text-align:right;width:60px">${item.quantity}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111;text-align:right;width:100px">${formatCurrency(item.unit_price)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111;text-align:right;width:100px">${formatCurrency(item.amount ?? item.unit_price * item.quantity)}</td>
          </tr>`
      }
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111">${item.description || '—'}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#111;text-align:right;width:120px">${formatCurrency(item.amount ?? 0)}</td>
        </tr>`
    })
    .join('')

  const headerRow =
    doc.type === 'invoice'
      ? `<tr style="border-bottom:2px solid #e5e5e5">
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:left">Description</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:right;width:60px">Qty</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:right;width:100px">Unit price</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:right;width:100px">Amount</th>
        </tr>`
      : `<tr style="border-bottom:2px solid #e5e5e5">
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:left">Description</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:#666;text-align:right;width:120px">Amount</th>
        </tr>`

  const discountRow =
    discountAmount > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;color:#666">Discount${doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}</td>
          <td style="padding:6px 0;font-size:13px;color:#ef4444;text-align:right">-${formatCurrency(discountAmount)}</td>
        </tr>`
      : ''

  const taxRow =
    taxRate > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;color:#666">GST (${taxRate}%)</td>
          <td style="padding:6px 0;font-size:13px;color:#333;text-align:right">${formatCurrency(tax)}</td>
        </tr>`
      : ''

  const metaLine = doc.type === 'quote' && doc.expiresAt
    ? `<p style="margin:4px 0 0;font-size:13px;color:#888">Expires: ${formatDate(doc.expiresAt)}</p>`
    : doc.type === 'invoice' && doc.dueDate
    ? `<p style="margin:4px 0 0;font-size:13px;color:#888">Due: ${formatDate(doc.dueDate)}</p>`
    : ''

  const bankDetails =
    doc.type === 'invoice' && (doc.bankAccountName || doc.bankBsb || doc.bankAccountNumber)
      ? `<div style="margin-top:32px;padding:16px;background:#f9f9f9;border-radius:8px">
          <p style="font-size:12px;font-weight:600;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em">Bank transfer details</p>
          ${doc.bankAccountName ? `<p style="font-size:13px;color:#333;margin:4px 0">Account name: ${doc.bankAccountName}</p>` : ''}
          ${doc.bankBsb ? `<p style="font-size:13px;color:#333;margin:4px 0">BSB: ${doc.bankBsb}</p>` : ''}
          ${doc.bankAccountNumber ? `<p style="font-size:13px;color:#333;margin:4px 0">Account number: ${doc.bankAccountNumber}</p>` : ''}
        </div>`
      : ''

  const notesSection = doc.notes
    ? `<div style="margin-top:24px">
        <p style="font-size:12px;font-weight:600;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em">Notes</p>
        <p style="font-size:13px;color:#555;white-space:pre-line;line-height:1.6">${doc.notes}</p>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${doc.type === 'quote' ? 'Quote' : 'Invoice'} ${doc.documentNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 48px; color: #111; max-width: 700px; margin: 0 auto; }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px">
    <div>
      ${doc.businessName ? `<p style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">${doc.businessName}</p>` : ''}
      <p style="font-size:14px;color:#666">${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:22px;font-weight:700;color:#111;text-transform:capitalize">${doc.type === 'quote' ? 'Quote' : 'Invoice'}</p>
      <p style="font-size:14px;color:#888;margin-top:4px">#${doc.documentNumber}</p>
      ${metaLine}
    </div>
  </div>

  ${doc.title ? `<p style="font-size:16px;font-weight:600;color:#111;margin-bottom:32px">${doc.title}</p>` : ''}

  <table style="width:100%;border-collapse:collapse">
    <thead>${headerRow}</thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="margin-top:24px;border-top:2px solid #e5e5e5;padding-top:16px">
    <table style="width:100%;border-collapse:collapse;margin-left:auto;max-width:280px">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#666">Subtotal</td>
        <td style="padding:6px 0;font-size:13px;color:#333;text-align:right">${formatCurrency(doc.subtotal)}</td>
      </tr>
      ${discountRow}
      ${taxRow}
      <tr style="border-top:1px solid #e5e5e5">
        <td style="padding:10px 0 6px;font-size:15px;font-weight:700;color:#111">Total</td>
        <td style="padding:10px 0 6px;font-size:15px;font-weight:700;color:#111;text-align:right">${formatCurrency(doc.total)}</td>
      </tr>
    </table>
  </div>

  ${bankDetails}
  ${notesSection}
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}
