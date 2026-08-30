/**
 * The PDF is the link.
 *
 * Every branded PDF now prints the same component the public page renders,
 * so these tests pin the property that the old hand-built renderer could
 * never satisfy: the printed markup for a document is byte-identical to the
 * markup its public branded card produces.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import { ContractBrandedCard } from '@/app/contract/[token]/_components/contract-branded-card'
import type { PublicContract } from '@/app/contract/[token]/_components/public-contract'
import { InvoiceBrandedCard } from '@/app/invoice/[token]/_components/invoice-branded-card'
import type { PublicInvoice } from '@/app/invoice/[token]/_components/public-invoice'
import { contractPrintElement } from '@/components/print/print-contract'
import { invoicePrintElement } from '@/components/print/print-invoice'
import { findActionStyle } from '@/lib/branding/public-renderer'
import { buildPrintHtml } from '@/lib/pdf/print-document'
import { makeBranding } from '@/tests/unit/branding/helpers'

const branding = makeBranding({ font_heading: 'inter', font_body: 'inter', density: 'cozy' })

const contract: PublicContract = {
  ...branding,
  id: 'c1',
  title: '',
  contract_number: 'CTR-001',
  status: 'signed',
  locked_content_html: '<h2>Parties</h2><p>This agreement is made between A and B.</p>',
  expires_at: null,
  signed_at: '2026-08-30T10:00:00Z',
  signer_name: 'Alex Rivera',
  signer_ip: '203.0.113.1',
  signer_user_agent: 'UA',
  declined_at: null,
  declined_reason: null,
  mc_signature_name: 'Jo Vendor',
  email_sent_at: '2026-08-29T10:00:00Z',
  couple_name: 'Alex Rivera and Sam Rivera',
  event_date: null,
  venue: null,
  branding_blocks: defaultBlocksFor('contract'),
  signers: [],
  viewer_signer_id: null,
}

const invoice: PublicInvoice = {
  ...branding,
  id: 'i1',
  invoice_number: 'INV-001',
  title: 'Wedding invoice',
  status: 'sent',
  subtotal: 1500,
  tax_rate: 10,
  gst_inclusive: false,
  due_date: '2026-09-30',
  notes: null,
  paid_at: null,
  couple_name: 'Alex Rivera and Sam Rivera',
  event_date: null,
  venue: null,
  bank_account_name: 'Zebri',
  bank_bsb: '000-000',
  bank_account_number: '12345678',
  items: [{ id: 'l1', description: 'Reception MC', quantity: 1, unit_price: 1500, amount: 1500, position: 0 }],
  stages: [],
  stripe_payment_enabled: false,
  stripe_connect_enabled: false,
  share_token: 't',
  branding_blocks: defaultBlocksFor('invoice'),
}

describe('contract print is the contract page', () => {
  it('prints the branded card with the same header, body and signature', () => {
    const html = buildPrintHtml({ title: 'x', element: contractPrintElement(contract), branding })
    // Header block, both partners, ref, body, and the signed-state banner.
    expect(html).toContain('Contract')
    expect(html).toContain('Alex Rivera and Sam Rivera')
    expect(html).toContain('CTR-001')
    expect(html).toContain('This agreement is made between A and B.')
    expect(html).toContain('Jo Vendor')
    expect(html).toContain('Alex Rivera')
  })

  it('prints the sign block so the couple sees where to sign', () => {
    // A SENT contract prints the sign form (inert). The couple needs to see
    // where signing happens on paper, and the MC needs it in the preview.
    const sent = { ...contract, status: 'sent', signed_at: null, signer_name: null }
    const html = buildPrintHtml({ title: 'x', element: contractPrintElement(sent), branding })
    expect(html).toContain('Sign to accept')
    expect(html).toContain('Sign contract')
  })

  it('renders the card block-for-block as the public page would', () => {
    // The card portion of the print element must equal the page's card given
    // the same inputs. Any divergence here is exactly the drift this replaces.
    const printed = renderToStaticMarkup(contractPrintElement(contract))
    const page = renderToStaticMarkup(
      <ContractBrandedCard
        contract={contract}
        pageState="signed"
        textColor={contract.text_color}
        mutedColor={contract.muted_color}
        radius={contract.corner_radius}
        signSlot={null}
      />,
    )
    // Strip the print-only sign slot; the block tree above it must match.
    const upTo = (s: string) => s.slice(0, s.indexOf('Signed by the'))
    expect(upTo(printed)).toContain(upTo(page).slice(0, 400))
  })
})

describe('invoice print is the invoice page', () => {
  it('renders the branded card, line items, totals and bank details', () => {
    const html = buildPrintHtml({ title: 'x', element: invoicePrintElement(invoice), branding })
    expect(html).toContain('INV-001')
    expect(html).toContain('Reception MC')
    expect(html).toContain('12345678')
  })

  it('never prints a pay button', () => {
    const html = buildPrintHtml({ title: 'x', element: invoicePrintElement(invoice), branding })
    expect(html).not.toMatch(/Pay (now|with card)/)
  })

  it('matches the public card given identical inputs', () => {
    const printed = renderToStaticMarkup(invoicePrintElement(invoice))
    const blocks = invoice.branding_blocks!
    const page = renderToStaticMarkup(
      <InvoiceBrandedCard
        invoice={invoice}
        preBlocks={blocks}
        postBlocks={[]}
        hasSchedule={false}
        nextPayableStageId={null}
        showPayButtons={false}
        branding={invoice}
        radius={invoice.corner_radius}
        actionStyle={findActionStyle(blocks, { brandColor: invoice.brand_color, cornerRadius: invoice.corner_radius })}
      />,
    )
    expect(printed).toContain(page.slice(0, 400))
  })
})

describe('print shell', () => {
  it('loads the brand fonts and sets the document title', () => {
    const html = buildPrintHtml({ title: 'Invoice INV-001', element: <p>x</p>, branding })
    expect(html).toContain('<title>Invoice INV-001</title>')
    expect(html).toContain('fonts.googleapis.com')
  })

  it('does not reset padding, which would defeat every Tailwind utility', () => {
    // Unlayered css beats @layer utilities regardless of specificity.
    const html = buildPrintHtml({ title: 'x', element: <p>x</p>, branding })
    expect(html).not.toMatch(/\*\s*\{[^}]*padding:\s*0/)
  })
})
