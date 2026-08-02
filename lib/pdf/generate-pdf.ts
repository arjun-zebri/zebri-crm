import { FONT_STACKS, googleFontsHref } from '@/lib/branding/fonts'
import { buildPublicBranding, type PublicBranding } from '@/lib/branding/public-branding'
import { STATUS_COLORS } from '@/lib/branding/status-colors'
import { pdfTypeCss } from '@/lib/pdf/pdf-styles'

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
  /** Invoice-only display flag: adds a "Prices include GST" note under
   *  the total. Never participates in any amount. */
  gstInclusive?: boolean
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
 * @param branding Optional branding to derive from (colours, fonts, logo).
 * @param brandingObj The full PublicBranding object for CSS custom properties.
 * @returns        The HTML string ready for print or inline preview.
 */
function generateContractHtml(
  doc: PdfDocumentData,
  branding?: PdfBrandingOpts,
  brandingObj?: PublicBranding,
): string {
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
  const headingColor = branding?.headingColor ?? textColor
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
    ? `<div style="margin-top:40px;padding:18px;background:var(--pdf-audit-bg);border:1px solid var(--pdf-audit-border);border-radius:8px">
        <p style="font-size:var(--pdf-fine-print);font-weight:600;color:var(--pdf-audit-text);margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em">Audit trail</p>
        <p style="font-size:var(--pdf-body);color:${textColor};margin:2px 0">Signed by ${doc.signerName || '-'}</p>
        <p style="font-size:var(--pdf-body);color:${textColor};margin:2px 0">On ${signedOn}</p>
        ${doc.signerIp ? `<p style="font-size:var(--pdf-body);color:${mutedColor};margin:2px 0">From IP ${doc.signerIp}</p>` : ''}
        ${doc.signerUserAgent ? `<p style="font-size:var(--pdf-fine-print);color:${mutedColor};margin:2px 0;word-break:break-all">${doc.signerUserAgent}</p>` : ''}
      </div>`
    : ''

  // The template references var(--pdf-*) throughout, so the :root block has
  // to be emitted even when no branding was passed. Skipping it would leave
  // every custom property undefined and each size would silently fall back
  // to the browser default, which is the exact drift this module prevents.
  const typeCss = pdfTypeCss(brandingObj ?? buildPublicBranding({}))

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Contract ${doc.documentNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap" rel="stylesheet" />
  ${fontsLink}
  <style>
    ${typeCss}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ${bodyFont}; padding: 48px; color: ${textColor}; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    h1, h2, h3 { font-family: ${headingFont}; color: ${headingColor}; }
    h1 { font-size: var(--pdf-doc-title); margin: 24px 0 10px; }
    h2 { font-size: var(--pdf-section-heading); margin: 20px 0 6px; }
    h3 { font-size: var(--pdf-body); margin: 16px 0 4px; }
    p { margin: 6px 0; color: ${textColor}; font-size: var(--pdf-body); }
    ul, ol { margin: 6px 0 6px 22px; color: ${textColor}; font-size: var(--pdf-body); }
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
      ${doc.businessName ? `<p style="font-size:var(--pdf-subtitle);font-weight:700;color:${textColor};margin-bottom:4px;margin-top:${logoTag ? '8px' : '0'}">${doc.businessName}</p>` : ''}
      <p style="font-size:var(--pdf-body);color:${mutedColor}">For ${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:var(--pdf-doc-title);font-weight:700;color:${brandColor}">Contract</p>
      <p style="font-size:var(--pdf-body);color:${mutedColor};margin-top:4px">#${doc.documentNumber}</p>
    </div>
  </div>

  ${doc.title ? `<h1 style="font-size:var(--pdf-doc-title);font-weight:600;margin-bottom:24px">${doc.title}</h1>` : ''}

  <div style="color:${textColor};font-size:var(--pdf-body)">${doc.contractHtml || ''}</div>

  <div style="margin-top:40px;padding-top:24px;border-top:1px solid var(--pdf-border);display:flex;gap:40px;flex-wrap:wrap">
    <div style="flex:1;min-width:220px">
      <p style="font-size:var(--pdf-fine-print);font-weight:600;color:${mutedColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by MC</p>
      <p style="font-size:var(--pdf-subtitle);font-family:${signatureCursive};color:${textColor}">${mcSig}</p>
      <p style="font-size:var(--pdf-body);color:${mutedColor};margin-top:4px">${doc.businessName || ''}</p>
    </div>
    ${doc.signerName ? `
    <div style="flex:1;min-width:220px">
      <p style="font-size:var(--pdf-fine-print);font-weight:600;color:${mutedColor};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Signed by Couple</p>
      <p style="font-size:var(--pdf-subtitle);font-family:${signatureCursive};color:${textColor}">${doc.signerName}</p>
      <p style="font-size:var(--pdf-body);color:${mutedColor};margin-top:4px">${signedOn || ''}</p>
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
  /** CSS colour for headings. */
  headingColor?: string
  /** CSS colour for subheadings / section labels. */
  subheadingColor?: string
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
    headingColor: branding.heading_color ?? branding.text_color,
    subheadingColor: branding.subheading_color ?? branding.muted_color,
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
 * @param doc            The document data (invoice / contract).
 * @param branding       Optional branding overrides (colours + fonts + logo).
 *                       When omitted, the PDF renders in the legacy
 *                       black-and-white style.
 * @param brandingObj    The full PublicBranding object for CSS custom properties.
 *                       Used to derive the type scale and colours.
 */
export function buildPdfHtml(
  doc: PdfDocumentData,
  branding?: PdfBrandingOpts,
  brandingObj?: PublicBranding,
): string {
  if (doc.type === 'contract') {
    return generateContractHtml(doc, branding, brandingObj)
  }

  // Resolve branding with safe defaults so the templating below
  // doesn't need to handle nulls inline.
  const brandColor = branding?.brandColor ?? '#111111'
  const textColor = branding?.textColor ?? '#111111'
  const mutedColor = branding?.mutedColor ?? '#666666'
  const headingColor = branding?.headingColor ?? textColor
  const subheadingColor = branding?.subheadingColor ?? mutedColor
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

  // One layout decision drives both the header and every row, so the two can
  // never disagree on column count. The Phase 2C.2 builder only captures
  // description + amount (and persists quantity=1, unit_price=amount for
  // forward compatibility), so Qty / Unit price would either be blank or just
  // repeat the amount. Only legacy multi-quantity items earn those columns —
  // same rule the public line-items block uses.
  const showQtyColumns =
    doc.type === 'invoice' &&
    doc.items.some(
      (item) => item.quantity != null && item.quantity !== 1 && item.unit_price != null,
    )

  const cellStyle = (extra = '') =>
    `padding:10px 0;border-bottom:1px solid var(--pdf-border);font-size:var(--pdf-body);color:${textColor}${extra}`

  const itemRows = doc.items
    .map((item) => {
      const amount = item.amount ?? (item.unit_price ?? 0) * (item.quantity ?? 1)
      if (showQtyColumns) {
        // A qty-1 line mixed in with multi-quantity ones still fills all four
        // cells, otherwise its amount would slide under the Qty heading.
        const quantity = item.quantity ?? 1
        const unitPrice = item.unit_price ?? amount
        return `
          <tr>
            <td style="${cellStyle()}">${item.description || '-'}</td>
            <td style="${cellStyle(';text-align:right;width:60px')}">${quantity}</td>
            <td style="${cellStyle(';text-align:right;width:100px')}">${formatCurrency(unitPrice)}</td>
            <td style="${cellStyle(';text-align:right;width:100px')}">${formatCurrency(amount)}</td>
          </tr>`
      }
      return `
        <tr>
          <td style="${cellStyle()}">${item.description || '-'}</td>
          <td style="${cellStyle(';text-align:right;width:120px')}">${formatCurrency(amount)}</td>
        </tr>`
    })
    .join('')

  const th = (label: string, width?: string) =>
    `<th style="padding:8px 0;font-size:var(--pdf-section-label);font-weight:600;color:${mutedColor};text-align:${width ? 'right' : 'left'}${width ? `;width:${width}` : ''};font-family:${headingFont}">${label}</th>`

  const headerRow = `<tr style="border-bottom:2px solid ${brandColor}">
          ${th('Description')}
          ${showQtyColumns ? `${th('Qty', '60px')}\n          ${th('Unit price', '100px')}\n          ${th('Amount', '100px')}` : th('Amount', '120px')}
        </tr>`

  const discountRow =
    discountAmount > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:var(--pdf-body);color:${mutedColor}">Discount${doc.discountType === 'percentage' ? ` (${doc.discountValue}%)` : ''}</td>
          <td style="padding:6px 0;font-size:var(--pdf-body);color:${STATUS_COLORS.error};text-align:right">-${formatCurrency(discountAmount)}</td>
        </tr>`
      : ''

  const taxRow =
    taxRate > 0
      ? `<tr>
          <td style="padding:6px 0;font-size:var(--pdf-body);color:${mutedColor}">GST (${taxRate}%)</td>
          <td style="padding:6px 0;font-size:var(--pdf-body);color:${textColor};text-align:right">${formatCurrency(tax)}</td>
        </tr>`
      : ''

  // Tax disclosure, not a money row: it sits under the total rather than
  // in the running tally, so nothing above it changes.
  const gstInclusiveRow = doc.gstInclusive
    ? `<tr>
          <td colspan="2" style="padding:2px 0 0;font-size:var(--pdf-body);color:${mutedColor};text-align:right">Prices include GST</td>
        </tr>`
    : ''

  const metaLine = doc.type === 'invoice' && doc.dueDate
    ? `<p style="margin:4px 0 0;font-size:var(--pdf-body);color:${mutedColor}">Due: ${formatDate(doc.dueDate)}</p>`
    : ''

  const bankDetails =
    doc.type === 'invoice' && (doc.bankAccountName || doc.bankBsb || doc.bankAccountNumber)
      ? `<div style="margin-top:32px;padding:16px;background:var(--pdf-bank-bg);border-radius:8px">
          <p style="font-size:var(--pdf-section-label);font-weight:600;color:${subheadingColor};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-family:${headingFont}">Bank transfer details</p>
          ${doc.bankAccountName ? `<p style="font-size:var(--pdf-body);color:${textColor};margin:4px 0">Account name: ${doc.bankAccountName}</p>` : ''}
          ${doc.bankBsb ? `<p style="font-size:var(--pdf-body);color:${textColor};margin:4px 0">BSB: ${doc.bankBsb}</p>` : ''}
          ${doc.bankAccountNumber ? `<p style="font-size:var(--pdf-body);color:${textColor};margin:4px 0">Account number: ${doc.bankAccountNumber}</p>` : ''}
        </div>`
      : ''

  const notesSection = doc.notes
    ? `<div style="margin-top:24px">
        <p style="font-size:var(--pdf-section-label);font-weight:600;color:${subheadingColor};margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;font-family:${headingFont}">Notes</p>
        <p style="font-size:var(--pdf-body);color:${mutedColor};white-space:pre-line;line-height:1.6">${doc.notes}</p>
      </div>`
    : ''

  // The template references var(--pdf-*) throughout, so the :root block has
  // to be emitted even when no branding was passed. Skipping it would leave
  // every custom property undefined and each size would silently fall back
  // to the browser default, which is the exact drift this module prevents.
  const typeCss = pdfTypeCss(brandingObj ?? buildPublicBranding({}))

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${'Invoice'} ${doc.documentNumber}</title>
  ${fontsLink}
  <style>
    ${typeCss}
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
      ${doc.businessName ? `<p class="heading" style="font-size:var(--pdf-subtitle);font-weight:700;color:${textColor};margin-bottom:4px">${doc.businessName}</p>` : ''}
      <p style="font-size:var(--pdf-body);color:${mutedColor}">${doc.coupleName}</p>
    </div>
    <div style="text-align:right">
      <p class="heading" style="font-size:var(--pdf-doc-title);font-weight:700;color:${headingColor};text-transform:capitalize">${'Invoice'}</p>
      <p style="font-size:var(--pdf-body);color:${mutedColor};margin-top:4px">#${doc.documentNumber}</p>
      ${metaLine}
    </div>
  </div>

  ${doc.title ? `<p class="heading" style="font-size:var(--pdf-section-heading);font-weight:600;color:${headingColor};margin-bottom:32px">${doc.title}</p>` : ''}

  <table style="width:100%;border-collapse:collapse">
    <thead>${headerRow}</thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="margin-top:24px;border-top:2px solid ${brandColor};padding-top:16px">
    <table style="width:100%;border-collapse:collapse;margin-left:auto;max-width:280px">
      <tr>
        <td style="padding:6px 0;font-size:var(--pdf-body);color:${mutedColor}">Subtotal</td>
        <td style="padding:6px 0;font-size:var(--pdf-body);color:${textColor};text-align:right">${formatCurrency(doc.subtotal)}</td>
      </tr>
      ${discountRow}
      ${taxRow}
      <tr style="border-top:1px solid var(--pdf-border)">
        <td class="heading" style="padding:10px 0 6px;font-size:var(--pdf-total);font-weight:700;color:${headingColor}">Total</td>
        <td class="heading" style="padding:10px 0 6px;font-size:var(--pdf-total);font-weight:700;color:${headingColor};text-align:right">${formatCurrency(doc.total)}</td>
      </tr>
      ${gstInclusiveRow}
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
 * sender's brand colours, fonts, and logo, and scales the type
 * scale from the global typography settings.
 *
 * @param doc       The document data (invoice or contract).
 * @param branding  Optional branding overrides (colours, fonts, logo).
 * @param brandingObj The full PublicBranding object for CSS custom properties.
 *                  Used to derive the type scale and colours.
 */
export function generateAndPrintPdf(
  doc: PdfDocumentData,
  branding?: PdfBrandingOpts,
  brandingObj?: PublicBranding,
) {
  const html = buildPdfHtml(doc, branding, brandingObj)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), doc.type === 'contract' ? 500 : 300)
}
