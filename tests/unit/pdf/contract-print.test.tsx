/**
 * The contract PDF must be the link: the same signatures, no browser print
 * chrome, and the certificate of completion only in the downloaded document.
 *
 * @module tests/unit/pdf/contract-print
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults'
import type { ContractSigner, PublicContract } from '@/app/contract/[token]/_components/public-contract'
import { buildContractPrintHtml, contractPrintElement } from '@/components/print/print-contract'
import { makeBranding } from '@/tests/unit/branding/helpers'

const SIGNED_AT = '2026-09-03T11:51:00Z'
const DRAWN_MARK = 'data:image/png;base64,iVBORw0KGgo='

const signer = (over: Partial<ContractSigner> & { id: string; name: string }): ContractSigner =>
  ({
    role: 'client',
    signing_order: 1,
    required: true,
    signed_at: SIGNED_AT,
    declined_at: null,
    ...over,
  }) as ContractSigner

/** A fully executed contract with one typed and one drawn signature. */
const executedContract = (): PublicContract =>
  ({
    ...makeBranding(),
    id: 'c1',
    title: 'Agreement',
    contract_number: 'CTR-006',
    status: 'signed',
    locked_content_html: '<p>Terms</p>',
    expires_at: null,
    signed_at: SIGNED_AT,
    signer_name: 'Tara Rahman',
    signer_ip: '::1',
    signer_user_agent: null,
    declined_at: null,
    declined_reason: null,
    mc_signature_name: null,
    email_sent_at: null,
    couple_name: 'Michael and Tara',
    event_date: null,
    venue: null,
    branding_blocks: defaultBlocksFor('contract'),
    audit_trail: [{ type: 'signed', name: 'Tara Rahman', at: SIGNED_AT }],
    signers: [
      signer({ id: 's1', name: 'Michael Smith', signing_order: 1 }),
      signer({
        id: 's2',
        name: 'Tara Rahman',
        signing_order: 2,
        signature_mode: 'drawn',
        signature_image: DRAWN_MARK,
      } as never),
    ],
    viewer_signer_id: null,
  }) as unknown as PublicContract

describe('contract print document', () => {
  it('carries both signature marks', () => {
    const html = buildContractPrintHtml(executedContract())
    // The drawn mark is a data URL, so it is already in the serialised markup.
    expect(html).toContain(DRAWN_MARK)
    // The typed mark needs the handwriting face to survive a document that has
    // no --font-signature variable, so the fallback must sit inside var().
    expect(html).toMatch(/font-family:var\(--font-signature, *&quot;Caveat&quot;\)/)
    expect(html).toContain('Caveat')
  })

  it('leaves no page margin for the browser to print its own header and footer', () => {
    // A non-zero @page margin is where Chrome paints the date, the document
    // title, `about:blank` and the page numbers.
    expect(buildContractPrintHtml(executedContract())).toContain('@page { margin: 0; }')
  })

  it('keeps the certificate of completion in the PDF and off the couple-facing page', () => {
    const contract = executedContract()
    const pdf = renderToStaticMarkup(contractPrintElement(contract))
    const screen = renderToStaticMarkup(contractPrintElement(contract, { certificate: false }))
    expect(pdf).toContain('Certificate of completion')
    expect(screen).not.toContain('Certificate of completion')
    // The signatures themselves stay on screen.
    expect(screen).toContain(DRAWN_MARK)
  })
})

describe('contract print fonts', () => {
  it('requests the signature face from Google Fonts in a well-formed stylesheet URL', () => {
    const html = buildContractPrintHtml(executedContract())
    const href = /<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]*)">/.exec(html)?.[1]
    expect(href).toBeTruthy()
    expect(href).toContain('family=Caveat')
    // css2 rejects a request whose `display` is not the final parameter, which
    // would silently drop the signature face and print it as body text.
    expect(href!.indexOf('display=swap')).toBeGreaterThan(href!.indexOf('family=Caveat'))
  })
})
