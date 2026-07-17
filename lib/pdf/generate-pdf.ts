import { FONT_STACKS, googleFontsHref } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'

export interface PdfLineItem {
  description: string
  amount?: number
  quantity?: number
  unit_price?: number
}

export interface PdfDocumentData {
  type: 'invoice' | 'contract'
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

/**
 * Render contract HTML with optional branding.
 *
 * When branding is provided, the contract adopts the sender's brand
 * color on headings, logo at the top, and custom fonts. Without
 * branding, renders in legacy black-and-white.
 *
 * @param doc      The contract document data.
 * @param branding Optional branding overrides (colours, fonts, logo).
 * @returns        The HTML string ready for print or inline preview.
 */
function generateContractHtml(doc: PdfDocumentData, branding?: PdfBrandingOpts): string {
  const signatureCursive = "Caveat, 'Brush Script MT', cursive"
  const mcSig = doc.mcSignatureName || doc.businessName || ''
  const signedOn = doc.signedAt
    ? new Date(doc.signedAt).toLocaleString('en-AU', {
        day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  // Resolve branding with safe defaults (same pattern as invoices).
  const brandColor = branding?.brandColor ?? '#111111'
  const textColor = branding?.textColor ?? '#111111'
  const mutedColor = branding?.mutedColor ?? '#666666'
  const headingFont =
    branding?.headingFontFamily ??
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const bodyFont =
    branding?.bodyFontFamily ??
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const fontsLink = branding?.fontsHref
    ? `<link rel="stylesheet" href="${branding.fontsHref}" />`
    : ''
  const logoTag = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="max-height:48px;max-width:200px;display:block;margin-bottom:12px" />`
    : ''

  const auditBlock = signedOn
    ? `<div style="margin-top:40px;padding:18px;background:#f5f9f6;border:1px solid #d1e4d7;border-radius:8px">
        <p style="font-size:11px;font-weight:600;color:#0f766e;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em">Audit trail</p>
        <p style="font-size:12px;color:#333;margin:2px 0">Signed by ${doc.signerName || '-'}</p>
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
  ${fontsLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${bodyFont}; padding: 48px; color: ${textColor}; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    h1, h2, h3 { font-family: ${headingFont}; color: ${brandColor}; }
    h1 { font-size: 22px; margin: 24px 0 10px; }
    h2 { font-size: 16px; margin: 20px 0 6px; }
    h3 { font-size: 14px; margin: 16px 0 4px; }
    p { margin: 6px 0; color: ${textColor}; font-size: 14px; }
    ul, ol { margin: 6px 0 6px 22px; color: ${textColor}; font-size: 14px; }
    li { margin: 2px 0; }
    li > p { margin: 0; }
    li > p + ul, li > p + ol { margin-top: 2px; }
    @media print { body { padding: 0; } @page { margin: 20mm; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px">
    <div>
      ${logoTag}
      ${doc.businessName ? `<p style="font-size:20px;font-weight:700;color:${textColor};margin-bottom:4px;margin-top:${logoTag ? '8px' : '0'}">${doc.businessName}</p>` : ''}
      <p style="font-size:14px;color:${mutedColor}">For ${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:22px;font-weight:700;color:${brandColor}">Contract</p>
      <p style="font-size:14px;color:${mutedColor};margin-top:4px">#${doc.documentNumber}</p>
    </div>
  </div>

  ${doc.title ? `<h1 style="font-size:22px;font-weight:600;margin-bottom:24px">${doc.title}</h1>` : ''}

  <div style="color:${textColor};font-size:14px">${doc.contractHtml || ''}</div>

  <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e5e5;display:flex;gap:40px;flex-wrap:wrap">
    <div style="flex:1;min-width:220px">
      <p style="font-size:11px;font-weight:600;color:${mutedColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by MC</p>
      <p style="font-size:24px;font-family:${signatureCursive};color:${textColor}">${mcSig}</p>
      <p style="font-size:12px;color:${mutedColor};margin-top:4px">${doc.businessName || ''}</p>
    </div>
    ${doc.signerName ? `
    <div style="flex:1;min-width:220px">
      <p style="font-size:11px;font-weight:600;color:${mutedColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by Couple</p>
      <p style="font-size:24px;font-family:${signatureCursive};color:${textColor}">${doc.signerName}</p>
      <p style="font-size:12px;color:${mutedColor};margin-top:4px">${signedOn || ''}</p>
    </div>` : ''}
  </div>

  ${auditBlock}
</body>
</html>`
}

/**
 * Optional branding context — when supplied, the PDF picks up the
 * user's heading + body font, brand colour accent on the title,
 * logo at the top, and tonal table headers.
 *
 * Caller is responsible for fetching the branding values (the
 * builder preview uses `useCurrentBranding`). When omitted, the
 * PDF renders in the legacy black-and-white style.
 */
export interface PdfBrandingOpts {
  brandColor?: string
  textColor?: string
  mutedColor?: string
  /** CSS font-family string for headings (e.g. `'Inter', sans-serif`). */
  headingFontFamily?: string
  /** CSS font-family string for body. */
  bodyFontFamily?: string
  /** Google-Fonts CSS link href (so the print window loads the font). */
  fontsHref?: string
  /** Public logo URL (top-left of the document). */
  logoUrl?: string
}

/**
 * Convert PublicBranding to PdfBrandingOpts.
 *
 * Single adapter used by all PDF callers (public pages, dashboard,
 * email pipelines) so branding logic lives in one place. Resolves
 * font IDs to CSS font-family strings and generates the Google Fonts
 * CDN href from the font names.
 *
 * @param branding The PublicBranding object (e.g. from RPC payload or buildPublicBranding).
 * @returns        PdfBrandingOpts ready to pass to buildPdfHtml or generateAndPrintPdf.
 */
export function publicBrandingToPdfOpts(branding: PublicBranding): PdfBrandingOpts {
  // Resolve font families using the same lookup tables as the public surfaces.
  // This ensures print PDFs match the web preview pixel for pixel.
  const headingFontFamily = FONT_STACKS[branding.font_heading]
  const bodyFontFamily = FONT_STACKS[branding.font_body]
  const fontsHref = googleFontsHref([branding.font_heading, branding.font_body])

  return {
    brandColor: branding.brand_color,
    textColor: branding.text_color,
    mutedColor: branding.muted_color,
    headingFontFamily,
    bodyFontFamily,
    fontsHref,
    logoUrl: branding.logo_url ?? undefined,
  }
}

/**
 * Build the HTML string that `generateAndPrintPdf` would print.
 *
 * Exported separately so the Quote / Invoice builder preview pane
 * (Phase 2C.2) can render the same HTML inline inside an iframe
 * without opening a new window. Same output bytes — the preview
 * and the eventual print stay in lockstep.
 *
 * @param doc      The document data (invoice / contract).
 * @param branding Optional branding overrides (colours + fonts +
 *                 logo). When omitted, the PDF renders in the
 *                 legacy black-and-white style.
 */
export function buildPdfHtml(doc: PdfDocumentData, branding?: PdfBrandingOpts): string {
  if (doc.type === 'contract') {
    return generateContractHtml(doc, branding)
  }

  // Resolve branding with safe defaults so the templating below
  // doesn't need to handle nulls inline.
  const brandColor = branding?.brandColor ?? '#111111'
  const textColor = branding?.textColor ?? '#111111'
  const mutedColor = branding?.mutedColor ?? '#666666'
  const headingFont =
    branding?.headingFontFamily ??
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const bodyFont =
    branding?.bodyFontFamily ??
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  const fontsLink = branding?.fontsHref
    ? `<link rel="stylesheet" href="${branding.fontsHref}" />`
    : ''
  const logoTag = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="max-height:48px;max-width:200px;display:block;margin-bottom:12px" />`
    : ''

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
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor}">${item.description || '-'}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor};text-align:right;width:60px">${item.quantity}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor};text-align:right;width:100px">${formatCurrency(item.unit_price)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor};text-align:right;width:100px">${formatCurrency(item.amount ?? item.unit_price * item.quantity)}</td>
          </tr>`
      }
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor}">${item.description || '-'}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:${textColor};text-align:right;width:120px">${formatCurrency(item.amount ?? 0)}</td>
        </tr>`
    })
    .join('')

  const headerRow =
    doc.type === 'invoice'
      ? `<tr style="border-bottom:2px solid ${brandColor}">
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:left;font-family:${headingFont}">Description</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:right;width:60px;font-family:${headingFont}">Qty</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:right;width:100px;font-family:${headingFont}">Unit price</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:right;width:100px;font-family:${headingFont}">Amount</th>
        </tr>`
      : `<tr style="border-bottom:2px solid ${brandColor}">
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:left;font-family:${headingFont}">Description</th>
          <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:right;width:120px;font-family:${headingFont}">Amount</th>
        </tr>`

  const discountRow =
    discountAmount > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;color:${mutedColor}">Discount${doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}</td>
          <td style="padding:6px 0;font-size:13px;color:#ef4444;text-align:right">-${formatCurrency(discountAmount)}</td>
        </tr>`
      : ''

  const taxRow =
    taxRate > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;color:${mutedColor}">GST (${taxRate}%)</td>
          <td style="padding:6px 0;font-size:13px;color:${textColor};text-align:right">${formatCurrency(tax)}</td>
        </tr>`
      : ''

  const metaLine = doc.type === 'invoice' && doc.dueDate
    ? `<p style="margin:4px 0 0;font-size:13px;color:${mutedColor}">Due: ${formatDate(doc.dueDate)}</p>`
    : ''

  const bankDetails =
    doc.type === 'invoice' && (doc.bankAccountName || doc.bankBsb || doc.bankAccountNumber)
      ? `<div style="margin-top:32px;padding:16px;background:#f9f9f9;border-radius:8px">
          <p style="font-size:12px;font-weight:600;color:${mutedColor};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-family:${headingFont}">Bank transfer details</p>
          ${doc.bankAccountName ? `<p style="font-size:13px;color:${textColor};margin:4px 0">Account name: ${doc.bankAccountName}</p>` : ''}
          ${doc.bankBsb ? `<p style="font-size:13px;color:${textColor};margin:4px 0">BSB: ${doc.bankBsb}</p>` : ''}
          ${doc.bankAccountNumber ? `<p style="font-size:13px;color:${textColor};margin:4px 0">Account number: ${doc.bankAccountNumber}</p>` : ''}
        </div>`
      : ''

  const notesSection = doc.notes
    ? `<div style="margin-top:24px">
        <p style="font-size:12px;font-weight:600;color:${mutedColor};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-family:${headingFont}">Notes</p>
        <p style="font-size:13px;color:${mutedColor};white-space:pre-line;line-height:1.6">${doc.notes}</p>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${'Invoice'} ${doc.documentNumber}</title>
  ${fontsLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${bodyFont}; padding: 48px; color: ${textColor}; max-width: 700px; margin: 0 auto; }
    h1, h2, h3, .heading { font-family: ${headingFont}; }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px">
    <div>
      ${logoTag}
      ${doc.businessName ? `<p class="heading" style="font-size:20px;font-weight:700;color:${textColor};margin-bottom:4px">${doc.businessName}</p>` : ''}
      <p style="font-size:14px;color:${mutedColor}">${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p class="heading" style="font-size:22px;font-weight:700;color:${brandColor};text-transform:capitalize">${'Invoice'}</p>
      <p style="font-size:14px;color:${mutedColor};margin-top:4px">#${doc.documentNumber}</p>
      ${metaLine}
    </div>
  </div>

  ${doc.title ? `<p class="heading" style="font-size:16px;font-weight:600;color:${textColor};margin-bottom:32px">${doc.title}</p>` : ''}

  <table style="width:100%;border-collapse:collapse">
    <thead>${headerRow}</thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="margin-top:24px;border-top:2px solid ${brandColor};padding-top:16px">
    <table style="width:100%;border-collapse:collapse;margin-left:auto;max-width:280px">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${mutedColor}">Subtotal</td>
        <td style="padding:6px 0;font-size:13px;color:${textColor};text-align:right">${formatCurrency(doc.subtotal)}</td>
      </tr>
      ${discountRow}
      ${taxRow}
      <tr style="border-top:1px solid #e5e5e5">
        <td class="heading" style="padding:10px 0 6px;font-size:15px;font-weight:700;color:${brandColor}">Total</td>
        <td class="heading" style="padding:10px 0 6px;font-size:15px;font-weight:700;color:${brandColor};text-align:right">${formatCurrency(doc.total)}</td>
      </tr>
    </table>
  </div>

  ${bankDetails}
  ${notesSection}
</body>
</html>`

  return html
}

/**
 * Generate and print a PDF document.
 *
 * Opens a new print-dialog window with the HTML rendering. Accepts
 * optional branding context — when supplied, the PDF adopts the
 * sender's brand colours, fonts, and logo.
 *
 * @param doc      The document data (invoice or contract).
 * @param branding Optional branding overrides (colours, fonts, logo).
 */
export function generateAndPrintPdf(doc: PdfDocumentData, branding?: PdfBrandingOpts) {
  const html = buildPdfHtml(doc, branding)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), doc.type === 'contract' ? 500 : 300)
}
