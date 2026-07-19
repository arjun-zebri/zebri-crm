/**
 * Guards the contract between the PDF templates and their CSS custom
 * properties: every var(--pdf-*) the HTML references must be defined in the
 * injected :root block.
 *
 * This exists because an undefined custom property fails silently. The
 * declaration is dropped, the element renders at the browser default, and
 * nothing in typecheck, lint, or the snapshot tests notices. The branding
 * object is an optional argument, so the no-branding path is the one that
 * has to be proven, not assumed.
 *
 * @module tests/unit/pdf/pdf-vars-defined.test
 */
import { describe, it, expect } from 'vitest'

import { buildPublicBranding } from '@/lib/branding/public-branding'
import { buildPdfHtml, type PdfDocumentData } from '@/lib/pdf/generate-pdf'

/** Minimal invoice payload; the fields below are all the template needs. */
const invoiceDoc: PdfDocumentData = {
  type: 'invoice',
  documentNumber: 'INV-001',
  title: 'Wedding MC services',
  status: 'sent',
  coupleName: 'Alex and Sam',
  businessName: 'Test MC',
  items: [{ description: 'Ceremony', quantity: 1, unit_price: 100 }],
  subtotal: 100,
  total: 100,
}

/** Minimal contract payload; routes through the contract builder instead. */
const contractDoc: PdfDocumentData = {
  ...invoiceDoc,
  type: 'contract',
  documentNumber: 'CON-001',
  contractHtml: '<p>Terms</p>',
}

/** Collects the custom properties an HTML string references and defines. */
function propertyUsage(html: string) {
  const referenced = new Set(
    [...html.matchAll(/var\((--pdf-[a-z0-9-]+)\)/g)].map((m) => m[1] as string)
  )
  const defined = new Set(
    [...html.matchAll(/(--pdf-[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string)
  )
  return { referenced, defined }
}

describe('PDF custom properties', () => {
  for (const [label, doc] of [
    ['invoice', invoiceDoc],
    ['contract', contractDoc],
  ] as const) {
    it(`defines every property the ${label} references when branding is supplied`, () => {
      const { referenced, defined } = propertyUsage(
        buildPdfHtml(doc, undefined, buildPublicBranding({}))
      )
      expect(referenced.size).toBeGreaterThan(0)
      expect([...referenced].filter((p) => !defined.has(p))).toEqual([])
    })

    it(`defines every property the ${label} references when branding is omitted`, () => {
      // The regression this file exists for: buildPdfHtml's branding argument
      // is optional and real callers do omit it, so the fallback path must
      // still emit the :root block.
      const { referenced, defined } = propertyUsage(buildPdfHtml(doc))
      expect(referenced.size).toBeGreaterThan(0)
      expect([...referenced].filter((p) => !defined.has(p))).toEqual([])
    })
  }
})
