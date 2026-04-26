export interface PdfLineItem {
  description: string
  amount?: number
  quantity?: number
  unit_price?: number
}

export interface PdfDocumentData {
  type: 'quote' | 'invoice' | 'contract'
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
  // Contract specific
  contractHtml?: string
  signerName?: string | null
  signedAt?: string | null
  signerIp?: string | null
  signerUserAgent?: string | null
  mcSignatureName?: string | null
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

function generateContractHtml(doc: PdfDocumentData): string {
  const signatureCursive = "Caveat, 'Brush Script MT', cursive"
  const mcSig = doc.mcSignatureName || doc.businessName || ''
  const signedOn = doc.signedAt
    ? new Date(doc.signedAt).toLocaleString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  const auditBlock = signedOn
    ? `<div style="margin-top:40px;padding:18px;background:#f5f9f6;border:1px solid #d1e4d7;border-radius:8px">
        <p style="font-size:11px;font-weight:600;color:#0f766e;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em">Audit trail</p>
        <p style="font-size:12px;color:#333;margin:2px 0">Signed by ${doc.signerName || '—'}</p>
        <p style="font-size:12px;color:#333;margin:2px 0">On ${signedOn}</p>
        ${doc.signerIp ? `<p style="font-size:12px;color:#555;margin:2px 0">From IP ${doc.signerIp}</p>` : ''}
        ${doc.signerUserAgent ? `<p style="font-size:11px;color:#777;margin:2px 0;word-break:break-all">${doc.signerUserAgent}</p>` : ''}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Contract ${doc.documentNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 48px; color: #111; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    h1 { font-size: 22px; margin: 24px 0 10px; color: #111; }
    h2 { font-size: 16px; margin: 20px 0 6px; color: #111; }
    h3 { font-size: 14px; margin: 16px 0 4px; color: #111; }
    p { margin: 6px 0; color: #333; font-size: 14px; }
    ul, ol { margin: 6px 0 6px 22px; color: #333; font-size: 14px; }
    li { margin: 2px 0; }
    li > p { margin: 0; }
    li > p + ul, li > p + ol { margin-top: 2px; }
    @media print { body { padding: 0; } @page { margin: 20mm; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
    <div>
      ${doc.businessName ? `<p style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px">${doc.businessName}</p>` : ''}
      <p style="font-size:14px;color:#666">For ${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:22px;font-weight:700;color:#111">Contract</p>
      <p style="font-size:14px;color:#888;margin-top:4px">#${doc.documentNumber}</p>
    </div>
  </div>

  ${doc.title ? `<h1 style="font-size:22px;font-weight:600;color:#111;margin-bottom:24px">${doc.title}</h1>` : ''}

  <div style="color:#333;font-size:14px">${doc.contractHtml || ''}</div>

  <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e5e5;display:flex;gap:40px;flex-wrap:wrap">
    <div style="flex:1;min-width:220px">
      <p style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by MC</p>
      <p style="font-size:24px;font-family:${signatureCursive};color:#111">${mcSig}</p>
      <p style="font-size:12px;color:#888;margin-top:4px">${doc.businessName || ''}</p>
    </div>
    ${doc.signerName ? `
    <div style="flex:1;min-width:220px">
      <p style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by Couple</p>
      <p style="font-size:24px;font-family:${signatureCursive};color:#111">${doc.signerName}</p>
      <p style="font-size:12px;color:#888;margin-top:4px">${signedOn || ''}</p>
    </div>` : ''}
  </div>

  ${auditBlock}
</body>
</html>`
}

export function generateAndPrintPdf(doc: PdfDocumentData) {
  if (doc.type === 'contract') {
    const html = generateContractHtml(doc)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
    return
  }

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
