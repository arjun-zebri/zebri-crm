'use client'

/**
 * The one way a branded document becomes a PDF.
 *
 * There is no second renderer. Each public surface already has a component
 * that IS the document the couple sees (`ContractBrandedCard`,
 * `InvoiceBrandedCard`, the vendor run sheet). Printing renders that same
 * component to static HTML, wraps it in a shell that loads the app's own
 * stylesheets and the brand fonts, and prints. The PDF matches the link
 * because it is literally the link.
 *
 * Before this, `generate-pdf.ts` hand-built a parallel HTML document for each
 * surface. The invoice PDF ignored the branding block tree entirely; the
 * contract PDF reproduced the header by hand and dropped per-block styles and
 * weights; the run sheet and vows PDFs had no branding at all. Every patch
 * made the copy imitate the original a little better and never converged.
 *
 * @module lib/pdf/print-document
 */

import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { DENSITY_PADDING } from '@/lib/branding/density'
import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame'
import { googleFontsHref } from '@/lib/branding/fonts'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { bodyFontFamily } from '@/lib/branding/public-surface'

export interface PrintDocumentOptions {
  /** Browser tab / PDF file title. */
  title: string
  /**
   * Paint the on-screen page canvas behind the card. The print window keeps
   * it (it is what the link looks like); the builder's preview iframe turns
   * it off, since the frame already sits inside a card and the tint reads as
   * a stray grey border.
   */
  canvas?: boolean
  /**
   * Draw a thin border around the page when the canvas is off. The builder
   * preview iframe wants it (the frame sits inside a card); a plain printed
   * document such as a couple script does not. Defaults to `!canvas`.
   */
  frame?: boolean
  /**
   * Suppress the browser's own print header and footer (date, title, URL,
   * page count). Browsers draw those in the page margin, so this sets the
   * `@page` margin to zero and puts the same 14mm back as body padding. On
   * for plain documents such as a couple script, where nothing outside the
   * text belongs on the page.
   */
  bare?: boolean
  /** The document, as the public page renders it. Must be hook-free. */
  element: ReactElement
  /** Branding, for the page canvas, body font and the Google Fonts link. */
  branding: PublicBranding | null | undefined
  /**
   * Unbranded documents (a couple script) carry their own fonts: a
   * stylesheet href for the shell's `<link>` and the CSS stack for `<body>`.
   * Both take precedence over the branding pair when given.
   */
  fonts?: { href: string; bodyStack: string }
}

/**
 * The app's own stylesheet `<link>` tags, for the print window.
 *
 * `window.open('')` gives a same-origin document with no styles. Loading the
 * same files is far more robust than serialising rules, and is what makes
 * the components' Tailwind classes work outside the app document.
 */
function stylesheetLinks(): string {
  if (typeof document === 'undefined') return ''
  // The script editor mounts its own Google Fonts link (`data-script-fonts`);
  // the shell adds the fonts it needs itself, so skip it here rather than
  // load the same stylesheet twice.
  const links = [...document.querySelectorAll('link[rel="stylesheet"]:not([data-script-fonts])')]
    .map((l) => (l as HTMLLinkElement).href)
    .filter(Boolean)
    .map((href) => `<link rel="stylesheet" href="${href}">`)
  // Inline <style> tags too. In dev, Turbopack delivers hot-reloaded CSS as an
  // inline tag rather than a linked file, so a print window that copied only
  // the <link>s rendered every recently-edited rule (logo box, table borders)
  // as if it did not exist. In production everything is linked and this is a
  // harmless no-op.
  const inline = [...document.querySelectorAll('style')]
    .map((el) => el.textContent ?? '')
    .filter((css) => css.trim().length > 0)
    .map((css) => `<style>${css}</style>`)
  return [...links, ...inline].join('\n  ')
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
}

/**
 * Build the complete print document.
 *
 * Exported separately from {@link printDocument} so the builder modals' PDF
 * preview tab can show exactly what will print, in an iframe.
 */
export function buildPrintHtml({ title, element, branding, canvas = true, frame = !canvas, bare = false, fonts: fontOverride }: PrintDocumentOptions): string {
  const canvasBg = canvas ? DOC_CANVAS_BG : '#fff'
  const body = renderToStaticMarkup(element)
  const fontHref = fontOverride
    ? fontOverride.href
    : branding?.font_heading && branding?.font_body
      ? googleFontsHref([branding.font_heading, branding.font_body])
      : null
  const fonts = fontHref ? `<link rel="stylesheet" href="${fontHref}">` : ''
  const pad = DENSITY_PADDING[branding?.density ?? 'cozy']
  const textColor = branding?.text_color ?? '#111827'
  const bodyStack = fontOverride ? fontOverride.bodyStack : branding ? bodyFontFamily(branding) : 'system-ui, sans-serif'

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  ${stylesheetLinks()}
  ${fonts}
  <style>
    /* No universal margin/padding reset: Tailwind's utilities live in
       @layer utilities and UNLAYERED css beats layered css regardless of
       specificity, so a blanket reset here would silently defeat every
       px-/py- class in the document. Preflight already covers the reset. */
    html, body { background: ${canvasBg}; }
    /* The app applies its base font through next/font's hashed class on
       <body>, which this document never carries. Set the brand body font on
       <body> here, exactly where the app does, so the blocks that inherit
       their font (footer, line items, text, tagline, payment details) resolve
       to the same face as the link instead of the browser default stack. */
    body { font-family: ${bodyStack}; color: ${textColor}; }
    @media print {
      ${bare ? '@page { margin: 0; } body { padding: 14mm; }' : '@page { margin: 14mm; }'}
      html, body { background: #fff; }
      /* The on-screen canvas tint and card shadow are screen chrome. */
      .print-canvas { background: #fff !important; padding-top: 0 !important; }
      .print-card { box-shadow: none !important; }
      /* Never split a row across pages; repeat table headers. */
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      h1, h2, h3 { page-break-after: avoid; }
      /* Couple scripts only (scoped, so contract and invoice pagination is
         untouched): a page-break node prints as a real page break, and
         paragraphs never leave a single line stranded. */
      .script-document hr[data-page-break] { break-before: page; border: 0; height: 0; margin: 0; visibility: hidden; }
      .script-document p { orphans: 2; widows: 2; }
    }
  </style>
</head>
<body>
  <div class="print-canvas min-h-screen ${pad.page}${frame ? ' rounded-control border border-border' : ''}">
    <div class="mx-auto w-full @container/doc" style="max-width:${DOC_MAX_WIDTH_PX}px">
      ${body}
    </div>
  </div>
</body>
</html>`
}

/**
 * Open a print window for a branded document and trigger print-to-PDF.
 *
 * Waits for the external stylesheets and then the web fonts to load before
 * printing: firing on a fixed timer can beat them and produce an unstyled
 * page, or one set in the fallback face (a script's Vietnamese and CJK
 * text depends on the Noto files arriving). A fallback timer guarantees the
 * user is never left staring at a page that will not print.
 */
export function printDocument(opts: PrintDocumentOptions): void {
  const html = buildPrintHtml(opts)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()

  let printed = false
  const fire = () => {
    if (printed) return
    printed = true
    win.print()
  }
  const afterFonts = () => {
    const fonts = win.document.fonts
    if (fonts && typeof fonts.ready?.then === 'function') void fonts.ready.then(() => setTimeout(fire, 150))
    else setTimeout(fire, 150)
  }
  if (win.document.readyState === 'complete') {
    afterFonts()
  } else {
    win.addEventListener('load', afterFonts)
  }
  setTimeout(fire, 5000)
}
